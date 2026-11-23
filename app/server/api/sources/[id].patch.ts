import { requireAdmin } from '~/server/utils/auth'
import { updateSource, updateSourceStatus } from '~/server/utils/repositories/sources'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID requerido' })
  }
  const body = await readBody(event)
  // If only status is provided, use the status endpoint
  if (body.status && Object.keys(body).length === 1) {
    const source = await updateSourceStatus(id, body.status)
    return source
  }
  const source = await updateSource(id, body)
  return source
})
