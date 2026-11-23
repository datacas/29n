/**
 * Triaje de Jev sobre las posiciones PENDIENTES (needs_review) con la evidencia actual.
 * Guarda en jev_shadow_reviews (run_kind=shadow, modo independent). No toca positions.
 *
 *   node scripts/spike12/triage_pending.ts
 */
import { randomUUID } from 'node:crypto'
import { JevClient } from '../../app/lib/jev/client.ts'
import { dbPool, loadPendingPositions, requireKeyOrExplain } from './common.ts'
import { analyzeAndStore, mapLimit } from './runner.ts'

requireKeyOrExplain()
const pool = dbPool()
try {
  const all = await loadPendingPositions(pool, ['needs_review'])
  const client = new JevClient()
  const runId = randomUUID()
  console.log(`${all.length} posiciones pendientes, modelo ${client.model}`)
  const out = await mapLimit(all, 4, (p) => analyzeAndStore(client, pool, { ...p, claims: p.claims.map((c) => ({ ...c, claudeStance: null })) }, 'independent', runId, 'shadow'))
  const g: Record<string, Record<string, number>> = {}
  for (const o of out) {
    g[o.position.party] ??= { high_confidence: 0, doubtful: 0, contradictory: 0 }
    g[o.position.party][o.triage.group]++
  }
  const tot = { high_confidence: 0, doubtful: 0, contradictory: 0 } as Record<string, number>
  for (const o of out) tot[o.triage.group]++
  console.log('Total:', tot)
  console.table(g)
} finally {
  await pool.end()
}
