import { query } from '~/server/utils/db'

// --- Types ---

export interface Entity {
  id: string
  name: string
  type: 'party' | 'coalition' | 'historical' | 'institutional'
  is_historical: boolean
  period_label: string | null
  country: string | null
  description: string | null
  created_at: string
}

// --- Repository ---

export async function listEntities(): Promise<Entity[]> {
  const { rows } = await query(`
    SELECT id, name, type, is_historical, period_label, country, description, created_at
    FROM entities
    ORDER BY is_historical DESC, name
  `)
  return rows
}

export async function getEntity(id: string): Promise<Entity | null> {
  const { rows } = await query(`
    SELECT id, name, type, is_historical, period_label, country, description, created_at
    FROM entities WHERE id = $1
  `, [id])
  return rows[0] || null
}

export async function createEntity(data: {
  name: string
  type: string
  is_historical?: boolean
  period_label?: string
  country?: string
  description?: string
}): Promise<Entity> {
  const { rows } = await query(`
    INSERT INTO entities (name, type, is_historical, period_label, country, description)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, name, type, is_historical, period_label, country, description, created_at
  `, [
    data.name,
    data.type || 'party',
    data.is_historical || false,
    data.period_label || null,
    data.country || null,
    data.description || null
  ])
  return rows[0]
}

export async function updateEntity(id: string, data: {
  name?: string
  type?: string
  is_historical?: boolean
  period_label?: string
  country?: string
  description?: string
}): Promise<Entity> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name) }
  if (data.type !== undefined) { fields.push(`type = $${idx++}`); values.push(data.type) }
  if (data.is_historical !== undefined) { fields.push(`is_historical = $${idx++}`); values.push(data.is_historical) }
  if (data.period_label !== undefined) { fields.push(`period_label = $${idx++}`); values.push(data.period_label) }
  if (data.country !== undefined) { fields.push(`country = $${idx++}`); values.push(data.country) }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description) }

  if (fields.length === 0) {
    return await getEntity(id)!
  }

  values.push(id)
  const { rows } = await query(`
    UPDATE entities SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, name, type, is_historical, period_label, country, description, created_at
  `, values)
  return rows[0]
}

export async function deleteEntity(id: string): Promise<void> {
  await query('DELETE FROM entities WHERE id = $1', [id])
}
