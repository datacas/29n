import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  try {
    const { rows } = await query(`
      SELECT manifest_jsonb, scoring_model_version
      FROM survey_releases
      WHERE id = $1 AND status = 'published'
      LIMIT 1
    `, [id])
    
    if (rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Release not found' })
    }
    
    // Return only the frozen manifest, not JOIN with editable tables
    return {
      releaseId: id,
      scoringModelVersion: rows[0].scoring_model_version,
      ...rows[0].manifest_jsonb
    }
  } catch (e) {
    if (e.statusCode === 404) throw e
    throw createError({ statusCode: 500, statusMessage: 'Database error' })
  }
})
