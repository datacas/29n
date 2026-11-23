import { requireAdmin } from '~/server/utils/auth'
import { getQuestion } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  const question = await getQuestion(id)
  if (!question) throw createError({ statusCode: 404, statusMessage: 'Pregunta no encontrada' })
  return question
})
