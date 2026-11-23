/**
 * Sugerencias de Jev para la postura (-2..+2) de las posiciones aprobadas (piloto, con evidencia).
 * Solo informativo: guarda en jev_value_suggestions. No toca positions.
 *
 *   node scripts/spike12/suggest_values.ts
 */
import { randomUUID } from 'node:crypto'
import { JevClient } from '../../app/lib/jev/client.ts'
import { suggestValue } from '../../app/lib/jev/value-suggestion.ts'
import { dbPool, loadPendingPositions, requireKeyOrExplain } from './common.ts'
import { mapLimit } from './runner.ts'

requireKeyOrExplain()
const pool = dbPool()
try {
  const done = new Set((await pool.query(`SELECT DISTINCT position_id FROM jev_value_suggestions`)).rows.map((r) => r.position_id))
  const all = (await loadPendingPositions(pool, ['approved', 'needs_review'])).filter((p) => !done.has(p.positionId))
  const client = new JevClient()
  const runId = randomUUID()
  console.log(`${all.length} posiciones sin sugerencia (aprobadas o en revisión), modelo ${client.model}`)
  const out = await mapLimit(all, 4, async (p) => {
    // Las citas se envían sin la etiqueta de postura de Claude
    const clean = { ...p, claims: p.claims.map((c) => ({ ...c, claudeStance: null })) }
    const s = await suggestValue(client, clean)
    await pool.query(
      `INSERT INTO jev_value_suggestions (position_id, run_id, choice, suggested_value, confidence, probabilities, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.positionId, runId, s.choice ?? 'contradictory', s.value, s.confidence, JSON.stringify(s.probabilities), client.model]
    )
    return { s, tokens: s.result.usage.input_tokens }
  })
  const dist: Record<string, number> = {}
  for (const { s } of out) dist[s.choice ?? 'sin respuesta'] = (dist[s.choice ?? 'sin respuesta'] ?? 0) + 1
  console.log('Distribución de sugerencias:', dist)
  console.log(`Coste ~ $${((out.reduce((a, o) => a + o.tokens, 0) / 1e6) * 0.042).toFixed(5)}`)
} finally {
  await pool.end()
}
