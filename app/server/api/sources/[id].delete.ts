import { requireAdmin } from '~/server/utils/auth'
import { deleteSource } from '~/server/utils/repositories/sources'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  }
  await deleteSource(id)
  return { success: true }
})
