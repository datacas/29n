import { requireAdmin } from '~/server/utils/auth'
import { upsertPosition } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  if (!body.entity_id || !body.question_id) {
    throw createError({ statusCode: 400, statusMessage: 'entity_id y question_id son requeridos' })
  }
  return upsertPosition(body)
})
