import { requireAdmin } from '~/server/utils/auth'
import { createQuestion } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  if (!body.canonical_text) {
    throw createError({ statusCode: 400, statusMessage: 'canonical_text es requerido' })
  }
  return createQuestion(body)
})
