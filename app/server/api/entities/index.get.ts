import { requireAdmin } from '~/server/utils/auth'
import { listEntities } from '~/server/utils/repositories/entities'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const list = await listEntities()
  return list
})
