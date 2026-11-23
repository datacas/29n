import { requireAdmin } from '~/server/utils/auth'
import { updateEntity } from '~/server/utils/repositories/entities'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  }
  const body = await readBody(event)
  const entity = await updateEntity(id, body)
  return entity
})
