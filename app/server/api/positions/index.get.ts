import { requireAdmin } from '~/server/utils/auth'
import { listPositions } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const filters: any = {}
  if (query.entity_id) filters.entity_id = query.entity_id as string
  if (query.question_id) filters.question_id = query.question_id as string
  if (query.review_status) filters.review_status = query.review_status as string
  return listPositions(Object.keys(filters).length ? filters : undefined)
})
