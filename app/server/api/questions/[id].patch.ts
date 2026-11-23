import { requireAdmin } from '~/server/utils/auth'
import { updateQuestion } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  const body = await readBody(event)
  return updateQuestion(id, body)
})
