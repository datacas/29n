import { requireAdmin } from '~/server/utils/auth'
import { updateClaim } from '~/server/utils/repositories/claims'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  const body = await readBody(event)
  return updateClaim(id, body)
})
