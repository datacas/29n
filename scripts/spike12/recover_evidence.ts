/**
 * Recupera evidencia que el extractor se dejó, a partir del escaneo (docs/spike12/scan/*.json).
 *
 *   node scripts/spike12/recover_evidence.ts plan  [--min 0.9] [--sentence-min 0.6] [--replace] [--exclude Q021] [--only Q009:Vox,Q009:PP] [--relaxed]   → no cambia nada
 *   node scripts/spike12/recover_evidence.ts apply [--replace]                              → aplica EL PLAN guardado
 *
 * plan:  para las posiciones sin evidencia, toma los párrafos con p >= --min, los trocea en frases, deja solo
 *        las frases que Jev marca como relevantes, verifica que son literales del PDF y guarda
 *        docs/spike12/recovery_plan.json + recovery_preview.md.
 * apply: copia de seguridad en positions_evidence_backup, añade esas citas como evidencia, pone la posición
 *        en 'needs_review' (NO la aprueba) y registra en editorial_audit. Solo si la posición sigue sin evidencia.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assessClaim } from '../../app/lib/jev/claim-relevance.ts'
import { JevClient } from '../../app/lib/jev/client.ts'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import { arg, dbPool, flag, loadPageTexts, OUT_DIR, requireKeyOrExplain } from './common.ts'
import { mapLimit } from './runner.ts'

const mode = process.argv[2]
const replace = flag('replace')
const relaxed = flag('relaxed') // admite frases que empiezan a media oración (texto cortado por columna o página)
const only = (arg('only', '') as string).split(',').map((x) => x.trim()).filter(Boolean) // p.ej. Q009:Vox,Q009:PP
const exclude = (arg('exclude', '') as string).split(',').map((x) => x.trim()).filter(Boolean)
// --replace: además de las posiciones sin evidencia, sustituye la evidencia de las RECHAZADAS que sí tenían citas (flojas)
const planPath = join(OUT_DIR, replace ? 'recovery_plan_replace.json' : 'recovery_plan.json')
const previewPath = join(OUT_DIR, replace ? 'recovery_preview_replace.md' : 'recovery_preview.md')
const sha = (v: unknown) => createHash('sha1').update(JSON.stringify(v ?? [])).digest('hex')
const pool = dbPool()

interface PlanItem {
  position_id: string
  question_id: string
  party: string
  question: string
  previous_status: string
  previous_evidence_sha: string
  claims: Array<{ literal_text: string; source_page: number; p_paragraph: number; p_sentence: number; quote_check: string }>
}

async function targets() {
  const { rows } = await pool.query(
    `SELECT p.id, e.name AS party, q.pilot_question_id AS qid, q.canonical_text AS text, p.review_status, p.evidence_jsonb
       FROM positions p JOIN entities e ON e.id = p.entity_id JOIN questions q ON q.id = p.question_id
      WHERE q.pilot_question_id IS NOT NULL AND NOT (q.pilot_question_id = ANY($1))
        AND (p.evidence_jsonb IS NULL OR jsonb_array_length(p.evidence_jsonb) = 0
             ${replace ? "OR p.review_status = 'rejected'" : ''})
        AND NOT EXISTS (SELECT 1 FROM positions_evidence_backup b WHERE b.position_id = p.id)
      ORDER BY 3, 2`,
    [exclude]
  )
  return only.length ? rows.filter((r: any) => only.includes(`${r.qid}:${r.party}`)) : rows
}

try {
  if (mode === 'plan') {
    requireKeyOrExplain()
    const min = Number(arg('min', '0.9'))
    const sMin = Number(arg('sentence-min', '0.6'))
    const client = new JevClient()
    const rows = await targets()
    const plan: PlanItem[] = []
    let calls = 0

    for (const r of rows) {
      const scan = JSON.parse(readFileSync(join(OUT_DIR, 'scan', `${r.party}.json`), 'utf8')).paragraphs as Array<{
        page: number; text: string; scores: Record<string, number>
      }>
      const paras = scan
        .filter((p) => (p.scores[r.qid] ?? 0) >= min)
        .sort((a, b) => b.scores[r.qid] - a.scores[r.qid])
        .slice(0, 2)
      if (!paras.length) continue

      const claims: PlanItem['claims'] = []
      const pages = loadPageTexts(r.party)
      for (const para of paras) {
        const sentences = para.text.split(/(?<=[.;:!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 25)
        const scored = await mapLimit(sentences, 4, async (s) => {
          calls++
          const a = await assessClaim(client, { questionText: r.text, party: r.party, literalText: s, sourcePage: para.page })
          return { s, p: a.pRelevant ?? 0 }
        })
        // Descarta frases rotas (las que hubo que corregir a mano en la primera pasada)
        const usable = (t: string) =>
          t.length >= (relaxed ? 30 : 40) && (relaxed || /^[A-ZÁÉÍÓÚÑÀÈÒÇ¿¡«"“]/.test(t.trim())) && !/[:]$/.test(t.trim()) && !/^[•·\-–]/.test(t.trim()) && !/\b\d{2,3}\s+[a-záéíóúñ]/.test(t)
        for (const { s, p } of scored.filter((x) => x.p >= sMin && usable(x.s)).sort((a, b) => b.p - a.p).slice(0, 3)) {
          const check = verifyQuote(s, pages, para.page)
          if (check === 'not_found' || check === 'no_source') continue
          claims.push({ literal_text: s, source_page: para.page, p_paragraph: para.scores[r.qid], p_sentence: p, quote_check: check })
        }
      }
      if (claims.length) {
        plan.push({ position_id: r.id, question_id: r.qid, party: r.party, question: r.text, previous_status: r.review_status, previous_evidence_sha: sha(r.evidence_jsonb), claims })
      }
    }

    writeFileSync(planPath, JSON.stringify({ created_at: new Date().toISOString(), min, sentenceMin: sMin, plan }, null, 1))
    const L = ['# Plan de recuperación de evidencia', '',
      `Umbral de párrafo p>=${min}, frase p>=${sMin}. ${plan.length} posiciones, ${plan.reduce((a, x) => a + x.claims.length, 0)} citas. **Nada aplicado.**`, '']
    for (const x of plan) {
      L.push(`## ${x.question_id} · ${x.party} (antes: ${x.previous_status})`, `*${x.question}*`, '')
      for (const c of x.claims) L.push(`- pág. ${c.source_page} · frase p=${c.p_sentence.toFixed(2)} · «${c.literal_text}»`)
      L.push('')
    }
    writeFileSync(previewPath, L.join('\n'))
    console.log(`Plan: ${plan.length} posiciones de ${rows.length} sin evidencia, ${plan.reduce((a, x) => a + x.claims.length, 0)} citas (${calls} llamadas a Jev)`)
    console.log(`Vista previa: ${previewPath}`)
  } else if (mode === 'apply') {
    const { plan } = JSON.parse(readFileSync(planPath, 'utf8')) as { plan: PlanItem[] }
    const client = await pool.connect()
    let done = 0, skipped = 0
    try {
      await client.query('BEGIN')
      for (const x of plan) {
        const { rows } = await client.query(
          `SELECT review_status, evidence_jsonb, review_note FROM positions WHERE id = $1 FOR UPDATE`, [x.position_id])
        const cur = rows[0]
        if (!cur || sha(cur.evidence_jsonb) !== (x.previous_evidence_sha ?? sha([])) || cur.review_status !== x.previous_status) {
          console.log(`SALTADA ${x.question_id} ${x.party}: la posición cambió desde el plan`)
          skipped++
          continue
        }
        await client.query(
          `INSERT INTO positions_evidence_backup (position_id, evidence_jsonb, reason) VALUES ($1, $2, $3)`,
          [x.position_id, JSON.stringify(cur.evidence_jsonb ?? []), `antes de recuperar/sustituir evidencia (estado previo: ${x.previous_status})`])
        const evidence = x.claims.map((c) => ({
          stance: 'unclear',
          conditions: 'Sin analizar (evidencia recuperada del escaneo; revisar)',
          source_page: c.source_page,
          literal_text: c.literal_text,
          affected_area: '',
          review_status: 'draft',
          normalized_text: '',
          source: 'jev-scan'
        }))
        await client.query(
          `UPDATE positions SET evidence_jsonb = $2, review_status = 'needs_review', stance_status = 'unknown',
                  reviewed_by = NULL, reviewed_at = NULL, review_note = NULL WHERE id = $1`,
          [x.position_id, JSON.stringify(evidence)])
        await client.query(
          `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
           VALUES ('jev-spike', 'recover_evidence', 'position', $1, $2, $3::jsonb)`,
          [x.position_id, `Evidencia recuperada ${x.question_id} × ${x.party}`, JSON.stringify({ claims: x.claims.length, previous_status: x.previous_status, previous_note: cur.review_note ?? null })])
        done++
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
    console.log(`Aplicado: ${done} posiciones pasadas a 'needs_review' con su evidencia (omitidas: ${skipped}). Copias en positions_evidence_backup.`)
  } else {
    console.error('Uso: recover_evidence.ts plan|apply')
    process.exit(1)
  }
} finally {
  await pool.end()
}
