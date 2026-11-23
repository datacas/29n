/**
 * Benchmark de Jev contra las DECISIONES EDITORIALES (aprobada / rechazada) sobre la evidencia actual.
 *
 *   node scripts/spike12/benchmark_decisions.ts
 *
 * Referencia: positions.review_status in (approved, rejected), solo posiciones piloto CON evidencia.
 * Origen de la evidencia:
 *   - original:   la sacó el extractor original (independiente de Jev) → subconjunto LIMPIO.
 *   - recuperada: elegida con ayuda de Jev (escaneo/filtro de relevancia) → circular, se informa aparte.
 * Ejecuta Jev en modo 'independent' sobre la evidencia ACTUAL y guarda en jev_shadow_reviews (run_kind=benchmark).
 */
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { JevClient } from '../../app/lib/jev/client.ts'
import type { PositionInput } from '../../app/lib/jev/types.ts'
import { dbPool, OUT_DIR, requireKeyOrExplain } from './common.ts'
import { analyzeAndStore, mapLimit } from './runner.ts'

requireKeyOrExplain()
const pool = dbPool()

function auc(pos: number[], neg: number[]): number | null {
  if (!pos.length || !neg.length) return null
  let w = 0
  for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0
  return w / (pos.length * neg.length)
}

try {
  const { rows } = await pool.query(
    `SELECT p.id, e.name AS party, q.pilot_question_id AS qid, q.canonical_text, p.review_status, p.stance_status, p.evidence_jsonb,
            EXISTS (SELECT 1 FROM editorial_audit a WHERE a.entity_id = p.id AND a.action = 'recover_evidence')
              OR EXISTS (SELECT 1 FROM positions_evidence_backup b WHERE b.position_id = p.id) AS recuperada
       FROM positions p JOIN entities e ON e.id = p.entity_id JOIN questions q ON q.id = p.question_id
      WHERE q.pilot_question_id IS NOT NULL AND p.review_status IN ('approved','rejected')
        AND p.evidence_jsonb IS NOT NULL AND jsonb_array_length(p.evidence_jsonb) > 0
      ORDER BY 3, 2`
  )
  const items = rows.map((r) => {
    const position: PositionInput = {
      positionId: r.id, party: r.party, questionId: r.qid, questionText: r.canonical_text,
      proposedStanceStatus: r.stance_status,
      claims: (r.evidence_jsonb as any[]).map((c) => ({
        literalText: c.literal_text ?? '',
        // La nota "Sin analizar..." de las recuperadas no es una condición real: no se envía a Jev
        conditions: c.source === 'jev-scan' ? null : (c.conditions ?? null),
        sourcePage: c.source_page ?? null,
        claudeStance: c.source === 'jev-scan' ? null : (c.stance ?? null)
      }))
    }
    return { position, approved: r.review_status === 'approved', origin: r.recuperada ? 'recuperada' : 'original' }
  })

  const client = new JevClient()
  const runId = randomUUID()
  console.log(`${items.length} posiciones decididas con evidencia (${items.filter((i) => i.origin === 'original').length} originales), modelo ${client.model}`)

  const out = await mapLimit(items, 4, async (it) => {
    const a = await analyzeAndStore(client, pool, it.position, 'independent', runId, 'benchmark')
    return { ...it, a }
  })

  const signals: Record<string, (o: (typeof out)[number]) => number | null> = {
    'P(evidencia insuficiente)': (o) => (o.a.verdict.evidenceSufficientP === null ? null : 1 - o.a.verdict.evidenceSufficientP),
    'P(postura = no claro)': (o) => o.a.verdict.stanceProbs.unclear ?? null,
    'P(relevancia no directa)': (o) => (Object.keys(o.a.verdict.relevanceProbs).length ? 1 - (o.a.verdict.relevanceProbs.direct ?? 0) : null),
    'P(contradicción)': (o) => o.a.verdict.contradictionP
  }

  const report: any = { run_id: runId, model: client.model, created_at: new Date().toISOString(), subsets: {} }
  for (const subset of ['todas', 'original', 'recuperada']) {
    const sel = out.filter((o) => subset === 'todas' || o.origin === subset)
    const rej = sel.filter((o) => !o.approved)
    const app = sel.filter((o) => o.approved)
    const r: any = { n: sel.length, aprobadas: app.length, rechazadas: rej.length, auc_para_anticipar_rechazo: {}, reglas: {} }
    for (const [name, f] of Object.entries(signals)) {
      const pos = rej.map(f).filter((x): x is number => x !== null)
      const neg = app.map(f).filter((x): x is number => x !== null)
      r.auc_para_anticipar_rechazo[name] = auc(pos, neg)
    }
    const rules: Record<string, (o: (typeof out)[number]) => boolean> = {
      'Jev: evidencia insuficiente (<0,5)': (o) => (o.a.verdict.evidenceSufficientP ?? 1) < 0.5,
      'Jev: postura "no claro"': (o) => o.a.verdict.stance === 'unclear',
      'Jev: relevancia no directa': (o) => o.a.verdict.relevance !== 'direct',
      'Triaje alta confianza': (o) => o.a.triage.group === 'high_confidence'
    }
    for (const [name, f] of Object.entries(rules)) {
      const m = sel.filter(f)
      r.reglas[name] = { marca: m.length, de_ellas_rechazadas: m.filter((o) => !o.approved).length, no_marca: sel.length - m.length, no_marca_rechazadas: rej.length - m.filter((o) => !o.approved).length }
    }
    report.subsets[subset] = r
  }
  report.coste_usd = out.reduce((a, o) => a + o.a.costUsd, 0)
  writeFileSync(join(OUT_DIR, 'decisions_benchmark.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 1))
} finally {
  await pool.end()
}
