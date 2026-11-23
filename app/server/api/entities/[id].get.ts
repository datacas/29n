import { requireAdmin } from '~/server/utils/auth'
import { getEntity } from '~/server/utils/repositories/entities'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  }
  const entity = await getEntity(id)
  if (!entity) {
    throw createError({ statusCode: 404, statusMessage: 'Entidad no encontrada' })
  }
  return entity
})
