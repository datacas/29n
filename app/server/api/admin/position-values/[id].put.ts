import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'
import { toPositionFields, ValueCodingError, type ValueChoice } from '~/lib/positions/value-coding'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  let fields
  try {
    fields = toPositionFields(body as ValueChoice)
  } catch (e) {
    if (e instanceof ValueCodingError) throw createError({ statusCode: 400, statusMessage: e.message })
    throw e
  }

  const { rows } = await query(
    `SELECT p.id FROM positions p JOIN questions q ON q.id = p.question_id
      WHERE p.id = $1 AND q.pilot_question_id IS NOT NULL AND p.review_status = 'approved'`,
    [id]
  )
  if (rows.length === 0) throw createError({ statusCode: 404, statusMessage: 'Posición aprobada no encontrada' })

  const { rows: sug } = await query(
    `SELECT suggested_value, choice FROM jev_value_suggestions WHERE position_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  )

  await query(
    `UPDATE positions SET value = $2, stance_status = $3, conditions = $4, reviewed_by = 'admin', reviewed_at = NOW() WHERE id = $1`,
    [id, fields.value, fields.stance_status, fields.conditions]
  )
  await query(
    `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
     VALUES ('admin', 'set_value', 'position', $1, $2, $3::jsonb)`,
    [id, `Postura asignada: ${fields.value ?? fields.stance_status}`,
     JSON.stringify({ ...fields, suggestion_shown: body?.suggestionShown === true, jev_suggestion: sug[0]?.suggested_value ?? null, jev_choice: sug[0]?.choice ?? null })]
  )
  return { ok: true, ...fields }
})
