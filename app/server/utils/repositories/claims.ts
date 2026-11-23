import { query } from '~/server/utils/db'

// --- Types ---

export interface Claim {
  id: string
  source_id: string
  literal_text: string
  normalized_text: string | null
  conditions: string | null
  exceptions: string | null
  topic_id: string | null
  status: 'draft' | 'machine_checked' | 'needs_review' | 'ready_for_batch' | 'approved' | 'rejected'
  created_at: string
}

export interface ClaimWithSource extends Claim {
  source_title: string
  entity_name: string
  topic_name: string | null
}

export interface ClaimEvidence {
  id: string
  claim_id: string
  passage_id: string
  quote: string
  support_type: 'direct' | 'indirect' | 'contextual'
}

// --- Claims ---

export async function listClaims(filters?: {
  source_id?: string
  status?: string
  topic_id?: string
}): Promise<ClaimWithSource[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters?.source_id) { conditions.push(`c.source_id = $${idx++}`); values.push(filters.source_id) }
  if (filters?.status) { conditions.push(`c.status = $${idx++}`); values.push(filters.status) }
  if (filters?.topic_id) { conditions.push(`c.topic_id = $${idx++}`); values.push(filters.topic_id) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await query(`
    SELECT c.id, c.source_id, c.literal_text, c.normalized_text, c.conditions,
           c.exceptions, c.topic_id, c.status, c.created_at,
           s.title AS source_title, e.name AS entity_name, t.name AS topic_name
    FROM claims c
    JOIN sources s ON s.id = c.source_id
    JOIN entities e ON e.id = s.entity_id
    LEFT JOIN topics t ON t.id = c.topic_id
    ${where}
    ORDER BY c.created_at DESC
  `, values)
  return rows
}

export async function getClaim(id: string): Promise<ClaimWithSource | null> {
  const { rows } = await query(`
    SELECT c.id, c.source_id, c.literal_text, c.normalized_text, c.conditions,
           c.exceptions, c.topic_id, c.status, c.created_at,
           s.title AS source_title, e.name AS entity_name, t.name AS topic_name
    FROM claims c
    JOIN sources s ON s.id = c.source_id
    JOIN entities e ON e.id = s.entity_id
    LEFT JOIN topics t ON t.id = c.topic_id
    WHERE c.id = $1
  `, [id])
  return rows[0] || null
}

export async function createClaim(data: {
  source_id: string
  literal_text: string
  normalized_text?: string
  conditions?: string
  exceptions?: string
  topic_id?: string
  status?: string
}): Promise<Claim> {
  const { rows } = await query(`
    INSERT INTO claims (source_id, literal_text, normalized_text, conditions, exceptions, topic_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, source_id, literal_text, normalized_text, conditions, exceptions, topic_id, status, created_at
  `, [
    data.source_id,
    data.literal_text,
    data.normalized_text || null,
    data.conditions || null,
    data.exceptions || null,
    data.topic_id || null,
    data.status || 'draft'
  ])
  return rows[0]
}

export async function updateClaimStatus(id: string, status: string): Promise<Claim> {
  const { rows } = await query(`
    UPDATE claims SET status = $1 WHERE id = $2
    RETURNING id, source_id, literal_text, normalized_text, conditions, exceptions, topic_id, status, created_at
  `, [status, id])
  return rows[0]
}

export async function batchUpdateClaimStatus(ids: string[], status: string): Promise<number> {
  const { rowCount } = await query(`
    UPDATE claims SET status = $1 WHERE id = ANY($2::uuid[])
  `, [status, ids])
  return rowCount || 0
}

export async function updateClaim(id: string, data: {
  literal_text?: string
  normalized_text?: string
  conditions?: string
  exceptions?: string
  topic_id?: string
  status?: string
}): Promise<Claim> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.literal_text !== undefined) { fields.push(`literal_text = $${idx++}`); values.push(data.literal_text) }
  if (data.normalized_text !== undefined) { fields.push(`normalized_text = $${idx++}`); values.push(data.normalized_text) }
  if (data.conditions !== undefined) { fields.push(`conditions = $${idx++}`); values.push(data.conditions) }
  if (data.exceptions !== undefined) { fields.push(`exceptions = $${idx++}`); values.push(data.exceptions) }
  if (data.topic_id !== undefined) { fields.push(`topic_id = $${idx++}`); values.push(data.topic_id || null) }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status) }

  if (fields.length === 0) return await getClaim(id) as unknown as Claim

  values.push(id)
  const { rows } = await query(`
    UPDATE claims SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, source_id, literal_text, normalized_text, conditions, exceptions, topic_id, status, created_at
  `, values)
  return rows[0]
}

export async function deleteClaim(id: string): Promise<void> {
  await query('DELETE FROM claims WHERE id = $1', [id])
}

// --- Claim Evidence ---

export async function listClaimEvidence(claimId: string): Promise<ClaimEvidence[]> {
  const { rows } = await query(`
    SELECT id, claim_id, passage_id, quote, support_type
    FROM claim_evidence WHERE claim_id = $1
  `, [claimId])
  return rows
}

export async function createClaimEvidence(data: {
  claim_id: string
  passage_id: string
  quote: string
  support_type?: string
}): Promise<ClaimEvidence> {
  const { rows } = await query(`
    INSERT INTO claim_evidence (claim_id, passage_id, quote, support_type)
    VALUES ($1, $2, $3, $4)
    RETURNING id, claim_id, passage_id, quote, support_type
  `, [
    data.claim_id,
    data.passage_id,
    data.quote,
    data.support_type || 'direct'
  ])
  return rows[0]
}

// --- Editorial Audit ---

export async function createAuditEntry(data: {
  admin_id: string
  action: string
  entity_type?: string
  entity_id?: string
  description?: string
  changes?: unknown
}): Promise<void> {
  await query(`
    INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    data.admin_id,
    data.action,
    data.entity_type || null,
    data.entity_id || null,
    data.description || null,
    data.changes ? JSON.stringify(data.changes) : null
  ])
}
