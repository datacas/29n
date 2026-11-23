import { requireAdmin } from '~/server/utils/auth'
import { listSources } from '~/server/utils/repositories/sources'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sources = await listSources()
  return sources
})
