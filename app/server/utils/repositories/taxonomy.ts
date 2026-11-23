import { query } from '~/server/utils/db'

// --- Types ---

export interface Dimension {
  id: string
  name: string
  code: string
  description: string | null
  is_scoring_dimension: boolean
  created_at: string
}

export interface Topic {
  id: string
  name: string
  code: string
  parent_id: string | null
  dimension_id: string | null
  depth: number
  created_at: string
}

export interface TopicWithDimension extends Topic {
  dimension_name: string | null
  dimension_code: string | null
}

// --- Dimensions ---

export async function listDimensions(): Promise<Dimension[]> {
  const { rows } = await query(`
    SELECT id, name, code, description, is_scoring_dimension, created_at
    FROM dimensions ORDER BY code
  `)
  return rows
}

export async function getDimension(id: string): Promise<Dimension | null> {
  const { rows } = await query(`
    SELECT id, name, code, description, is_scoring_dimension, created_at
    FROM dimensions WHERE id = $1
  `, [id])
  return rows[0] || null
}

export async function createDimension(data: {
  name: string
  code: string
  description?: string
  is_scoring_dimension?: boolean
}): Promise<Dimension> {
  const { rows } = await query(`
    INSERT INTO dimensions (name, code, description, is_scoring_dimension)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, code, description, is_scoring_dimension, created_at
  `, [
    data.name,
    data.code,
    data.description || null,
    data.is_scoring_dimension ?? true
  ])
  return rows[0]
}

export async function updateDimension(id: string, data: {
  name?: string
  code?: string
  description?: string
  is_scoring_dimension?: boolean
}): Promise<Dimension> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name) }
  if (data.code !== undefined) { fields.push(`code = $${idx++}`); values.push(data.code) }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description) }
  if (data.is_scoring_dimension !== undefined) { fields.push(`is_scoring_dimension = $${idx++}`); values.push(data.is_scoring_dimension) }

  if (fields.length === 0) return await getDimension(id)!

  values.push(id)
  const { rows } = await query(`
    UPDATE dimensions SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, name, code, description, is_scoring_dimension, created_at
  `, values)
  return rows[0]
}

export async function deleteDimension(id: string): Promise<void> {
  await query('DELETE FROM dimensions WHERE id = $1', [id])
}

// --- Topics ---

export async function listTopics(): Promise<TopicWithDimension[]> {
  const { rows } = await query(`
    SELECT t.id, t.name, t.code, t.parent_id, t.dimension_id, t.depth, t.created_at,
           d.name AS dimension_name, d.code AS dimension_code
    FROM topics t
    LEFT JOIN dimensions d ON d.id = t.dimension_id
    ORDER BY t.code
  `)
  return rows
}

export async function getTopicsByDimension(dimensionId: string): Promise<Topic[]> {
  const { rows } = await query(`
    SELECT id, name, code, parent_id, dimension_id, depth, created_at
    FROM topics WHERE dimension_id = $1
    ORDER BY code
  `, [dimensionId])
  return rows
}

export async function createTopic(data: {
  name: string
  code: string
  parent_id?: string
  dimension_id?: string
  depth?: number
}): Promise<Topic> {
  const { rows } = await query(`
    INSERT INTO topics (name, code, parent_id, dimension_id, depth)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, code, parent_id, dimension_id, depth, created_at
  `, [
    data.name,
    data.code,
    data.parent_id || null,
    data.dimension_id || null,
    data.depth ?? 1
  ])
  return rows[0]
}

export async function updateTopic(id: string, data: {
  name?: string
  code?: string
  parent_id?: string
  dimension_id?: string
  depth?: number
}): Promise<Topic> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name) }
  if (data.code !== undefined) { fields.push(`code = $${idx++}`); values.push(data.code) }
  if (data.parent_id !== undefined) { fields.push(`parent_id = $${idx++}`); values.push(data.parent_id || null) }
  if (data.dimension_id !== undefined) { fields.push(`dimension_id = $${idx++}`); values.push(data.dimension_id || null) }
  if (data.depth !== undefined) { fields.push(`depth = $${idx++}`); values.push(data.depth) }

  if (fields.length === 0) {
    const { rows } = await query('SELECT id, name, code, parent_id, dimension_id, depth, created_at FROM topics WHERE id = $1', [id])
    return rows[0]
  }

  values.push(id)
  const { rows } = await query(`
    UPDATE topics SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, name, code, parent_id, dimension_id, depth, created_at
  `, values)
  return rows[0]
}

export async function deleteTopic(id: string): Promise<void> {
  await query('DELETE FROM topics WHERE id = $1', [id])
}
