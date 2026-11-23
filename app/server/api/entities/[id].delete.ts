import { requireAdmin } from '~/server/utils/auth'
import { deleteEntity } from '~/server/utils/repositories/entities'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  }
  await deleteEntity(id)
  return { success: true }
})
