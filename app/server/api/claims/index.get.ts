import { requireAdmin } from '~/server/utils/auth'
import { listClaims } from '~/server/utils/repositories/claims'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const filters: any = {}
  if (query.source_id) filters.source_id = query.source_id as string
  if (query.status) filters.status = query.status as string
  if (query.topic_id) filters.topic_id = query.topic_id as string
  return listClaims(Object.keys(filters).length ? filters : undefined)
})
