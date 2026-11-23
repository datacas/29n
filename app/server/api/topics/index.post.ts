import { requireAdmin } from '~/server/utils/auth'
import { createTopic } from '~/server/utils/repositories/taxonomy'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  if (!body.name || !body.code) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre y código son requeridos' })
  }
  return createTopic(body)
})
