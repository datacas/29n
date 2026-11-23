import { query } from '~/server/utils/db'

export default defineEventHandler(async () => {
  try {
    const { rows } = await query(`
      SELECT c.id, c.slug, c.title, c.description, c.category, c.created_at,
             sr.id AS release_id, sr.version AS release_version
      FROM consultations c
      JOIN survey_releases sr ON sr.consultation_id = c.id
      WHERE sr.status = 'published'
      ORDER BY c.created_at DESC
    `)
    return rows
  } catch {
    return []
  }
})
