import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const { question_id, party, note } = body

  // Find the position in PostgreSQL
  const result = await query(
    `UPDATE positions p
     SET review_status = 'needs_review',
         reviewed_by = 'admin',
         reviewed_at = NOW(),
         review_note = COALESCE($3::text, p.review_note)
     FROM questions q, entities e
     WHERE q.pilot_question_id = $1
       AND e.name = $2
       AND p.entity_id = e.id
       AND p.question_id = q.id
     RETURNING p.id, p.review_status`,
    [question_id, party, note || null]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 404, message: `Posición no encontrada: ${question_id} × ${party}` })
  }

  // Log to editorial_audit
  await query(
    `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
     VALUES ('admin', 'request_review', 'position', $1, $2, $3::jsonb)`,
    [result.rows[0].id, `Revisión solicitada ${question_id} × ${party}`, JSON.stringify({ question_id, party, note })]
  )

  return {
    success: true,
    question_id,
    party,
    status: 'needs_review',
    timestamp: new Date().toISOString(),
    position_id: result.rows[0].id,
  }
})
