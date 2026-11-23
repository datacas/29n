/**
 * Recalcula SOLO el triaje de los registros ya guardados (shadow y benchmark), con las reglas actuales de
 * app/lib/jev/triage.ts. No llama a Jev y no toca positions: actualiza triage_group/triage_reasons.
 *
 *   node scripts/spike12/retriage.ts
 */
import { triage } from '../../app/lib/jev/triage.ts'
import type { JevVerdict, QuoteStatus } from '../../app/lib/jev/types.ts'
import { dbPool } from './common.ts'

const pool = dbPool()
try {
  const { rows } = await pool.query(
    `SELECT id, verdict, claude_class, quote_statuses FROM jev_shadow_reviews`
  )
  const counts: Record<string, number> = { high_confidence: 0, doubtful: 0, contradictory: 0 }
  for (const r of rows) {
    const t = triage({
      verdict: r.verdict as JevVerdict,
      quoteStatuses: (r.quote_statuses ?? []) as QuoteStatus[]
    })
    counts[t.group]++
    await pool.query(`UPDATE jev_shadow_reviews SET triage_group = $2, triage_reasons = $3 WHERE id = $1`, [
      r.id, t.group, JSON.stringify(t.reasons)
    ])
  }
  console.log(`Triaje recalculado en ${rows.length} registros:`, counts)
} finally {
  await pool.end()
}
