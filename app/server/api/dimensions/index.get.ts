import { requireAdmin } from '~/server/utils/auth'
import { listDimensions } from '~/server/utils/repositories/taxonomy'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listDimensions()
})
