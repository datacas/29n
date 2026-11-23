import { requireAdmin } from '~/server/utils/auth'
import { listQuestions } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const filters: any = {}
  if (query.consultation_id) filters.consultation_id = query.consultation_id as string
  if (query.topic_id) filters.topic_id = query.topic_id as string
  if (query.status) filters.status = query.status as string
  if (query.depth_level) filters.depth_level = Number(query.depth_level)
  return listQuestions(Object.keys(filters).length ? filters : undefined)
})
