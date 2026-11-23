import { query } from '~/server/utils/db'

// --- Types ---

export interface Question {
  id: string
  consultation_id: string | null
  topic_id: string | null
  canonical_text: string
  answer_type: 'scale' | 'categorical'
  options: unknown
  depth_level: number
  status: 'draft' | 'reviewed' | 'published'
  created_at: string
}

export interface QuestionWithTopic extends Question {
  topic_name: string | null
  topic_code: string | null
  dimension_name: string | null
  dimension_code: string | null
}

export interface Position {
  id: string
  entity_id: string
  question_id: string
  claim_id: string | null
  value: number | null
  categorical_value: string | null
  evidence_summary: string | null
  conditions: string | null
  review_status: 'draft' | 'machine_checked' | 'needs_review' | 'approved' | 'rejected'
  stance_status: 'approved' | 'explicit_neutral' | 'ambiguous' | 'not_stated' | 'unknown' | 'not_comparable' | 'conflicting_sources' | 'conditional'
  not_comparable_reason: string | null
  created_at: string
}

export interface PositionWithEntity extends Position {
  entity_name: string
  question_text: string
  claim_text: string | null
}

// --- Questions ---

export async function listQuestions(filters?: {
  consultation_id?: string
  topic_id?: string
  status?: string
  depth_level?: number
}): Promise<QuestionWithTopic[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters?.consultation_id) { conditions.push(`q.consultation_id = $${idx++}`); values.push(filters.consultation_id) }
  if (filters?.topic_id) { conditions.push(`q.topic_id = $${idx++}`); values.push(filters.topic_id) }
  if (filters?.status) { conditions.push(`q.status = $${idx++}`); values.push(filters.status) }
  if (filters?.depth_level) { conditions.push(`q.depth_level = $${idx++}`); values.push(filters.depth_level) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await query(`
    SELECT q.id, q.consultation_id, q.topic_id, q.canonical_text, q.answer_type,
           q.options, q.depth_level, q.status, q.created_at,
           t.name AS topic_name, t.code AS topic_code,
           d.name AS dimension_name, d.code AS dimension_code
    FROM questions q
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN dimensions d ON d.id = t.dimension_id
    ${where}
    ORDER BY q.created_at DESC
  `, values)
  return rows
}

export async function getQuestion(id: string): Promise<QuestionWithTopic | null> {
  const { rows } = await query(`
    SELECT q.id, q.consultation_id, q.topic_id, q.canonical_text, q.answer_type,
           q.options, q.depth_level, q.status, q.created_at,
           t.name AS topic_name, t.code AS topic_code,
           d.name AS dimension_name, d.code AS dimension_code
    FROM questions q
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN dimensions d ON d.id = t.dimension_id
    WHERE q.id = $1
  `, [id])
  return rows[0] || null
}

export async function createQuestion(data: {
  consultation_id?: string
  topic_id?: string
  canonical_text: string
  answer_type?: string
  options?: unknown
  depth_level?: number
  status?: string
}): Promise<Question> {
  const { rows } = await query(`
    INSERT INTO questions (consultation_id, topic_id, canonical_text, answer_type, options, depth_level, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, consultation_id, topic_id, canonical_text, answer_type, options, depth_level, status, created_at
  `, [
    data.consultation_id || null,
    data.topic_id || null,
    data.canonical_text,
    data.answer_type || 'scale',
    data.options ? JSON.stringify(data.options) : null,
    data.depth_level ?? 1,
    data.status || 'draft'
  ])
  return rows[0]
}

export async function updateQuestion(id: string, data: {
  consultation_id?: string
  topic_id?: string
  canonical_text?: string
  answer_type?: string
  options?: unknown
  depth_level?: number
  status?: string
}): Promise<Question> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.consultation_id !== undefined) { fields.push(`consultation_id = $${idx++}`); values.push(data.consultation_id || null) }
  if (data.topic_id !== undefined) { fields.push(`topic_id = $${idx++}`); values.push(data.topic_id || null) }
  if (data.canonical_text !== undefined) { fields.push(`canonical_text = $${idx++}`); values.push(data.canonical_text) }
  if (data.answer_type !== undefined) { fields.push(`answer_type = $${idx++}`); values.push(data.answer_type) }
  if (data.options !== undefined) { fields.push(`options = $${idx++}`); values.push(data.options ? JSON.stringify(data.options) : null) }
  if (data.depth_level !== undefined) { fields.push(`depth_level = $${idx++}`); values.push(data.depth_level) }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status) }

  if (fields.length === 0) return await getQuestion(id) as unknown as Question

  values.push(id)
  const { rows } = await query(`
    UPDATE questions SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, consultation_id, topic_id, canonical_text, answer_type, options, depth_level, status, created_at
  `, values)
  return rows[0]
}

export async function deleteQuestion(id: string): Promise<void> {
  await query('DELETE FROM questions WHERE id = $1', [id])
}

// --- Positions ---

export async function listPositions(filters?: {
  entity_id?: string
  question_id?: string
  review_status?: string
}): Promise<PositionWithEntity[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters?.entity_id) { conditions.push(`p.entity_id = $${idx++}`); values.push(filters.entity_id) }
  if (filters?.question_id) { conditions.push(`p.question_id = $${idx++}`); values.push(filters.question_id) }
  if (filters?.review_status) { conditions.push(`p.review_status = $${idx++}`); values.push(filters.review_status) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await query(`
    SELECT p.id, p.entity_id, p.question_id, p.claim_id, p.value, p.categorical_value,
           p.evidence_summary, p.conditions, p.review_status, p.stance_status,
           p.not_comparable_reason, p.created_at,
           e.name AS entity_name, q.canonical_text AS question_text,
           c.literal_text AS claim_text
    FROM positions p
    JOIN entities e ON e.id = p.entity_id
    JOIN questions q ON q.id = p.question_id
    LEFT JOIN claims c ON c.id = p.claim_id
    ${where}
    ORDER BY e.name, q.canonical_text
  `, values)
  return rows
}

export async function getPosition(entityId: string, questionId: string): Promise<Position | null> {
  const { rows } = await query(`
    SELECT id, entity_id, question_id, claim_id, value, categorical_value,
           evidence_summary, conditions, review_status, stance_status,
           not_comparable_reason, created_at
    FROM positions WHERE entity_id = $1 AND question_id = $2
  `, [entityId, questionId])
  return rows[0] || null
}

export async function upsertPosition(data: {
  entity_id: string
  question_id: string
  claim_id?: string
  value?: number
  categorical_value?: string
  evidence_summary?: string
  conditions?: string
  review_status?: string
  stance_status?: string
  not_comparable_reason?: string
}): Promise<Position> {
  const { rows } = await query(`
    INSERT INTO positions (entity_id, question_id, claim_id, value, categorical_value,
                           evidence_summary, conditions, review_status, stance_status, not_comparable_reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (entity_id, question_id) DO UPDATE SET
      claim_id = EXCLUDED.claim_id,
      value = EXCLUDED.value,
      categorical_value = EXCLUDED.categorical_value,
      evidence_summary = EXCLUDED.evidence_summary,
      conditions = EXCLUDED.conditions,
      review_status = EXCLUDED.review_status,
      stance_status = EXCLUDED.stance_status,
      not_comparable_reason = EXCLUDED.not_comparable_reason
    RETURNING id, entity_id, question_id, claim_id, value, categorical_value,
              evidence_summary, conditions, review_status, stance_status,
              not_comparable_reason, created_at
  `, [
    data.entity_id,
    data.question_id,
    data.claim_id || null,
    data.value ?? null,
    data.categorical_value || null,
    data.evidence_summary || null,
    data.conditions || null,
    data.review_status || 'draft',
    data.stance_status || 'unknown',
    data.not_comparable_reason || null
  ])
  return rows[0]
}

export async function updatePosition(id: string, data: {
  claim_id?: string
  value?: number
  categorical_value?: string
  evidence_summary?: string
  conditions?: string
  review_status?: string
  stance_status?: string
  not_comparable_reason?: string
}): Promise<Position> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.claim_id !== undefined) { fields.push(`claim_id = $${idx++}`); values.push(data.claim_id || null) }
  if (data.value !== undefined) { fields.push(`value = $${idx++}`); values.push(data.value ?? null) }
  if (data.categorical_value !== undefined) { fields.push(`categorical_value = $${idx++}`); values.push(data.categorical_value || null) }
  if (data.evidence_summary !== undefined) { fields.push(`evidence_summary = $${idx++}`); values.push(data.evidence_summary || null) }
  if (data.conditions !== undefined) { fields.push(`conditions = $${idx++}`); values.push(data.conditions || null) }
  if (data.review_status !== undefined) { fields.push(`review_status = $${idx++}`); values.push(data.review_status) }
  if (data.stance_status !== undefined) { fields.push(`stance_status = $${idx++}`); values.push(data.stance_status) }
  if (data.not_comparable_reason !== undefined) { fields.push(`not_comparable_reason = $${idx++}`); values.push(data.not_comparable_reason || null) }

  if (fields.length === 0) {
    const { rows } = await query(`
      SELECT id, entity_id, question_id, claim_id, value, categorical_value,
             evidence_summary, conditions, review_status, stance_status,
             not_comparable_reason, created_at
      FROM positions WHERE id = $1
    `, [id])
    return rows[0]
  }

  values.push(id)
  const { rows } = await query(`
    UPDATE positions SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, entity_id, question_id, claim_id, value, categorical_value,
              evidence_summary, conditions, review_status, stance_status,
              not_comparable_reason, created_at
  `, values)
  return rows[0]
}

export async function deletePosition(id: string): Promise<void> {
  await query('DELETE FROM positions WHERE id = $1', [id])
}

// --- Coverage Matrix ---

export interface CoverageCell {
  entity_id: string
  entity_name: string
  question_id: string
  question_text: string
  dimension_name: string | null
  has_position: boolean
  position_status: string | null
  stance_status: string | null
}

export async function getCoverageMatrix(entityIds: string[], questionIds: string[]): Promise<CoverageCell[]> {
  if (entityIds.length === 0 || questionIds.length === 0) return []

  const { rows } = await query(`
    SELECT e.id AS entity_id, e.name AS entity_name,
           q.id AS question_id, q.canonical_text AS question_text,
           d.name AS dimension_name,
           CASE WHEN p.id IS NOT NULL THEN true ELSE false END AS has_position,
           p.review_status AS position_status,
           p.stance_status AS stance_status
    FROM unnest($1::uuid[]) AS e_id
    CROSS JOIN unnest($2::uuid[]) AS q_id
    JOIN entities e ON e.id = e_id
    JOIN questions q ON q.id = q_id
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN dimensions d ON d.id = t.dimension_id
    LEFT JOIN positions p ON p.entity_id = e_id AND p.question_id = q_id
    ORDER BY e.name, q.canonical_text
  `, [entityIds, questionIds])
  return rows
}
