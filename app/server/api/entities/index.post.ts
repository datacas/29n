import { requireAdmin } from '~/server/utils/auth'
import { createEntity } from '~/server/utils/repositories/entities'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'El nombre es requerido' })
  }
  const entity = await createEntity(body)
  return entity
})
