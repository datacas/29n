/**
 * Paso 6-7: compara Jev y Claude contra las etiquetas HUMANAS de benchmark_sample.json.
 *
 *   TYPESAFE_API_KEY=... node scripts/spike12/benchmark.ts
 *
 * Se niega a ejecutar si faltan etiquetas humanas o la clave. No se inventa ningún resultado.
 * Ejecuta Jev en dos modos (independent y with_proposal) para medir si ver la propuesta de
 * Claude lo ancla. Escribe docs/spike12/benchmark_report.json y .md.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { JevClient } from '../../app/lib/jev/client.ts'
import { agreement, computeMetrics, type Scored } from '../../app/lib/jev/metrics.ts'
import { STANCE_CLASSES, type JevMode, type StanceClass } from '../../app/lib/jev/types.ts'
import { arg, dbPool, loadPendingPositions, OUT_DIR, requireKeyOrExplain } from './common.ts'
import { analyzeAndStore, mapLimit } from './runner.ts'

const samplePath = join(OUT_DIR, 'benchmark_sample.json')
let sample: any
try {
  sample = JSON.parse(readFileSync(samplePath, 'utf8'))
} catch {
  console.error(`No existe ${samplePath}. Ejecuta antes: node scripts/spike12/sample.ts`)
  process.exit(1)
}

const missing = sample.items.filter((i: any) => !STANCE_CLASSES.includes(i.human?.stance) || !i.human?.annotator)
if (missing.length) {
  console.error(
    `BLOQUEADO: ${missing.length}/${sample.items.length} items sin etiqueta humana (human.stance + human.annotator).\n` +
      'La referencia debe ser humana; no se usan las etiquetas de Claude como verdad.'
  )
  process.exit(2)
}
requireKeyOrExplain()

const pool = dbPool()
try {
  const pending = await loadPendingPositions(pool)
  const byId = new Map(pending.map((p) => [p.positionId, p]))
  const client = new JevClient()
  const runId = randomUUID()
  const modes: JevMode[] = ['independent', 'with_proposal']

  const results: Record<string, Scored[]> = { 'jev:independent': [], 'jev:with_proposal': [], claude: [] }
  const pairs: Array<[StanceClass | null, StanceClass | null]> = []
  const disagreements: any[] = []

  for (const mode of modes) {
    const out = await mapLimit(sample.items, 4, async (item: any) => {
      const position = byId.get(item.position_id)
      if (!position) throw new Error(`Posición ${item.position_id} ya no está pendiente/existente`)
      const a = await analyzeAndStore(client, pool, position, mode, runId, 'benchmark')
      return { item, a }
    })
    for (const { item, a } of out) {
      const gold = item.human.stance as StanceClass
      results[`jev:${mode}`].push({
        gold, predicted: a.jevClass, latencyMs: a.latencyMs, inputTokens: a.inputTokens, costUsd: a.costUsd
      })
      if (mode === 'independent') {
        results.claude.push({ gold, predicted: a.claudeClass })
        pairs.push([a.jevClass, a.claudeClass])
      }
      if (a.jevClass !== gold) {
        disagreements.push({ position_id: item.position_id, party: item.party, q: item.question_id, mode, gold, jev: a.jevClass, claude: a.claudeClass })
      }
    }
  }

  const report = {
    spike: 'SPIKE-12',
    run_id: runId,
    model: client.model,
    created_at: new Date().toISOString(),
    n: sample.items.length,
    human_annotators: [...new Set(sample.items.map((i: any) => i.human.annotator))],
    metrics: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, computeMetrics(v)])),
    jev_vs_claude_agreement: agreement(pairs),
    disagreements_with_human: disagreements
  }
  writeFileSync(join(OUT_DIR, 'benchmark_report.json'), JSON.stringify(report, null, 2))

  const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`)
  const lines = ['# SPIKE-12 — Informe de benchmark', '', `Modelo: \`${client.model}\` · n=${report.n} · run ${runId}`, '',
    '| Sistema | Acierto (respondidas) | Acierto total | Abstención | F1 macro | Falsos apoyos | Falsas oposiciones | Inversiones | p50 ms | p95 ms | Coste USD |',
    '|---|---|---|---|---|---|---|---|---|---|---|']
  for (const [k, m] of Object.entries(report.metrics) as [string, ReturnType<typeof computeMetrics>][]) {
    lines.push(`| ${k} | ${pct(m.accuracyAnswered)} | ${pct(m.accuracyOverall)} | ${pct(m.abstentionRate)} | ${pct(m.macroF1)} | ${m.falseSupport} | ${m.falseOppose} | ${m.polarityFlips} | ${m.latencyMs.p50 ?? '—'} | ${m.latencyMs.p95 ?? '—'} | ${m.costUsd.toFixed(5)} |`)
  }
  writeFileSync(join(OUT_DIR, 'benchmark_report.md'), lines.join('\n') + '\n')
  console.log(lines.join('\n'))
  console.log(`\nInforme completo: ${join(OUT_DIR, 'benchmark_report.json')}`)
} finally {
  await pool.end()
}
