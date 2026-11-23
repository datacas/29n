/**
 * Paso 8-9: procesa en modo shadow las posiciones pendientes.
 * Guarda en jev_shadow_reviews; NO cambia positions.review_status ni nada editorial.
 *
 *   TYPESAFE_API_KEY=... node scripts/spike12/shadow.ts [--mode with_proposal|independent] [--force]
 *
 * Por defecto exige que exista un benchmark_report.json (el benchmark "lo justifica");
 * --force lo salta bajo tu responsabilidad.
 */
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { JevClient } from '../../app/lib/jev/client.ts'
import type { JevMode } from '../../app/lib/jev/types.ts'
import { arg, dbPool, flag, loadPendingPositions, OUT_DIR, requireKeyOrExplain } from './common.ts'
import { analyzeAndStore, mapLimit } from './runner.ts'

const mode = (arg('mode', 'with_proposal') as JevMode)
if (mode !== 'independent' && mode !== 'with_proposal') {
  console.error('--mode debe ser independent o with_proposal')
  process.exit(1)
}
if (!flag('force') && !existsSync(join(OUT_DIR, 'benchmark_report.json'))) {
  console.error('BLOQUEADO: no hay benchmark_report.json. Primero el benchmark con etiquetas humanas (o usa --force).')
  process.exit(2)
}
requireKeyOrExplain()

const pool = dbPool()
try {
  const positions = await loadPendingPositions(pool)
  const client = new JevClient()
  const runId = randomUUID()
  console.log(`Shadow run ${runId}: ${positions.length} posiciones, modo ${mode}, modelo ${client.model}`)

  const done = await mapLimit(positions, 4, (p) => analyzeAndStore(client, pool, p, mode, runId, 'shadow'))

  const groups: Record<string, number> = { high_confidence: 0, doubtful: 0, contradictory: 0 }
  for (const d of done) groups[d.triage.group]++
  const cost = done.reduce((a, d) => a + d.costUsd, 0)
  console.log('Triaje:', groups)
  console.log(`Coste estimado: $${cost.toFixed(5)} · tokens entrada: ${done.reduce((a, d) => a + d.inputTokens, 0)}`)
  console.log('review_status sin tocar. Revisa el triaje en /admin/jev-triage')
} finally {
  await pool.end()
}
