import { requireAdmin } from '~/server/utils/auth'
import { deleteQuestion } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  await deleteQuestion(id)
  return { success: true }
})
