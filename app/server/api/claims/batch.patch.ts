import { requireAdmin } from '~/server/utils/auth'
import { batchUpdateClaimStatus } from '~/server/utils/repositories/claims'
import { createAuditEntry } from '~/server/utils/repositories/claims'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  if (!body.ids || !body.status) {
    throw createError({ statusCode: 400, statusMessage: 'ids y status son requeridos' })
  }
  const count = await batchUpdateClaimStatus(body.ids, body.status)
  await createAuditEntry({
    admin_id: 'admin',
    action: 'batch_update_claims',
    entity_type: 'claim',
    description: `Updated ${count} claims to status: ${body.status}`,
    changes: { ids: body.ids, status: body.status }
  })
  return { success: true, count }
})
