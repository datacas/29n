import { requireAdmin } from '~/server/utils/auth'
import { getCoverageMatrix } from '~/server/utils/repositories/questions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const entityIds = (query.entity_ids as string)?.split(',') || []
  const questionIds = (query.question_ids as string)?.split(',') || []
  return getCoverageMatrix(entityIds, questionIds)
})
