import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'

/** Sugerencias de Jev (última por posición). Solo informativas; la pantalla las pide bajo demanda. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { rows } = await query(`
    SELECT DISTINCT ON (position_id) position_id, choice, suggested_value, confidence
      FROM jev_value_suggestions ORDER BY position_id, created_at DESC
  `)
  const out: Record<string, { choice: string; value: number | null; confidence: number | null }> = {}
  for (const r of rows) {
    out[r.position_id] = { choice: r.choice, value: r.suggested_value, confidence: r.confidence === null ? null : Number(r.confidence) }
  }
  return out
})
