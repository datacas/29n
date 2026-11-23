import { requireAdmin } from '~/server/utils/auth'
import { getSource } from '~/server/utils/repositories/sources'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  }
  const source = await getSource(id)
  if (!source) {
    throw createError({ statusCode: 404, statusMessage: 'Fuente no encontrada' })
  }
  return source
})
