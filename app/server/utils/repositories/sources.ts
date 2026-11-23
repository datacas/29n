import { query } from '~/server/utils/db'

// --- Types ---

export interface Source {
  id: string
  entity_id: string
  title: string
  type: 'program' | 'constitution' | 'manifesto'
  original_url: string | null
  storage_path: string
  sha256_hash: string | null
  license: string | null
  language: string
  year: number | null
  edition: string | null
  status: 'uploaded' | 'parsed' | 'reviewed' | 'accepted' | 'rejected'
  created_at: string
}

export interface SourceWithEntity extends Source {
  entity_name: string
  entity_type: string
}

// --- Repository ---

export async function listSources(): Promise<SourceWithEntity[]> {
  const { rows } = await query(`
    SELECT s.id, s.entity_id, s.title, s.type, s.original_url, s.storage_path,
           s.sha256_hash, s.license, s.language, s.year, s.edition, s.status, s.created_at,
           e.name AS entity_name, e.type AS entity_type
    FROM sources s
    JOIN entities e ON e.id = s.entity_id
    ORDER BY s.created_at DESC
  `)
  return rows
}

export async function getSource(id: string): Promise<SourceWithEntity | null> {
  const { rows } = await query(`
    SELECT s.id, s.entity_id, s.title, s.type, s.original_url, s.storage_path,
           s.sha256_hash, s.license, s.language, s.year, s.edition, s.status, s.created_at,
           e.name AS entity_name, e.type AS entity_type
    FROM sources s
    JOIN entities e ON e.id = s.entity_id
    WHERE s.id = $1
  `, [id])
  return rows[0] || null
}

export async function getSourcesByEntity(entityId: string): Promise<Source[]> {
  const { rows } = await query(`
    SELECT id, entity_id, title, type, original_url, storage_path,
           sha256_hash, license, language, year, edition, status, created_at
    FROM sources WHERE entity_id = $1
    ORDER BY created_at DESC
  `, [entityId])
  return rows
}

export async function updateSourceStatus(id: string, status: string): Promise<Source> {
  const { rows } = await query(`
    UPDATE sources SET status = $1 WHERE id = $2
    RETURNING id, entity_id, title, type, original_url, storage_path,
              sha256_hash, license, language, year, edition, status, created_at
  `, [status, id])
  return rows[0]
}

export async function updateSource(id: string, data: {
  title?: string
  type?: string
  original_url?: string
  license?: string
  language?: string
  year?: number
  edition?: string
}): Promise<Source> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title) }
  if (data.type !== undefined) { fields.push(`type = $${idx++}`); values.push(data.type) }
  if (data.original_url !== undefined) { fields.push(`original_url = $${idx++}`); values.push(data.original_url) }
  if (data.license !== undefined) { fields.push(`license = $${idx++}`); values.push(data.license) }
  if (data.language !== undefined) { fields.push(`language = $${idx++}`); values.push(data.language) }
  if (data.year !== undefined) { fields.push(`year = $${idx++}`); values.push(data.year) }
  if (data.edition !== undefined) { fields.push(`edition = $${idx++}`); values.push(data.edition) }

  if (fields.length === 0) {
    const result = await getSource(id)
    return result as unknown as Source
  }

  values.push(id)
  const { rows } = await query(`
    UPDATE sources SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, entity_id, title, type, original_url, storage_path,
              sha256_hash, license, language, year, edition, status, created_at
  `, values)
  return rows[0]
}

export async function deleteSource(id: string): Promise<void> {
  await query('DELETE FROM sources WHERE id = $1', [id])
}

// --- Passages ---

export interface Passage {
  id: string
  source_id: string
  page: number | null
  article_ref: string | null
  literal_text: string
  normalized_text: string | null
  coordinates: unknown
}

export async function listPassages(sourceId: string): Promise<Passage[]> {
  const { rows } = await query(`
    SELECT id, source_id, page, article_ref, literal_text, normalized_text, coordinates
    FROM source_passages WHERE source_id = $1
    ORDER BY page
  `, [sourceId])
  return rows
}

export async function insertPassages(passages: Array<{
  source_id: string
  page: number
  article_ref?: string
  literal_text: string
  normalized_text?: string
  coordinates?: unknown
}>): Promise<void> {
  for (const p of passages) {
    await query(`
      INSERT INTO source_passages (source_id, page, article_ref, literal_text, normalized_text, coordinates)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      p.source_id,
      p.page,
      p.article_ref || null,
      p.literal_text,
      p.normalized_text || null,
      p.coordinates ? JSON.stringify(p.coordinates) : null
    ])
  }
}

// --- Document Jobs ---

export interface DocumentJob {
  id: string
  source_id: string
  status: string
  error_message: string | null
  metadata: unknown
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export async function createDocumentJob(sourceId: string): Promise<DocumentJob> {
  const { rows } = await query(`
    INSERT INTO document_jobs (source_id, status)
    VALUES ($1, 'pending')
    RETURNING id, source_id, status, error_message, metadata, started_at, completed_at, created_at
  `, [sourceId])
  return rows[0]
}

export async function updateDocumentJob(jobId: string, data: {
  status?: string
  error_message?: string
  metadata?: unknown
}): Promise<DocumentJob> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status) }
  if (data.error_message !== undefined) { fields.push(`error_message = $${idx++}`); values.push(data.error_message) }
  if (data.metadata !== undefined) { fields.push(`metadata = $${idx++}`); values.push(JSON.stringify(data.metadata)) }

  if (data.status === 'completed' || data.status === 'failed_pdf' || data.status === 'failed_llm' || data.status === 'failed_verify') {
    fields.push('completed_at = $' + idx++)
    values.push(new Date().toISOString())
  }
  if (data.status === 'extracting' || data.status === 'classifying' || data.status === 'verifying') {
    if (!fields.includes('started_at')) {
      fields.push('started_at = COALESCE(started_at, $' + idx + ')')
      values.push(new Date().toISOString())
    }
  }

  if (fields.length === 0) return await getDocumentJob(jobId)!

  values.push(jobId)
  const { rows } = await query(`
    UPDATE document_jobs SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, source_id, status, error_message, metadata, started_at, completed_at, created_at
  `, values)
  return rows[0]
}

export async function getDocumentJob(id: string): Promise<DocumentJob | null> {
  const { rows } = await query(`
    SELECT id, source_id, status, error_message, metadata, started_at, completed_at, created_at
    FROM document_jobs WHERE id = $1
  `, [id])
  return rows[0] || null
}

export async function listDocumentJobs(): Promise<DocumentJob[]> {
  const { rows } = await query(`
    SELECT id, source_id, status, error_message, metadata, started_at, completed_at, created_at
    FROM document_jobs
    ORDER BY created_at DESC
  `)
  return rows
}
