import { requireAdmin } from '~/server/utils/auth'
import { createClaim } from '~/server/utils/repositories/claims'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  if (!body.source_id || !body.literal_text) {
    throw createError({ statusCode: 400, statusMessage: 'source_id y literal_text son requeridos' })
  }
  return createClaim(body)
})
