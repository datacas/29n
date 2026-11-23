import { query } from '~/server/utils/db'
import { buildReleasePayload } from '~/lib/release/content'

/**
 * Endpoint público: datos para ejecutar la encuesta de un release PUBLICADO.
 * Sin autenticación y sin aceptar respuestas.
 * Si el manifiesto trae `content`, se sirve ese contenido congelado (editar posiciones o preguntas
 * después de publicar no cambia lo que ve el votante). Los releases antiguos sin `content` se leen en vivo.
 */
export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  try {
    const { rows } = await query(
      `SELECT sr.manifest_jsonb, sr.scoring_model_version, sr.version,
              c.slug AS consultation_slug, c.title AS consultation_title, c.description AS consultation_description, c.metadata AS consultation_metadata
         FROM survey_releases sr JOIN consultations c ON c.id = sr.consultation_id
        WHERE sr.id = $1 AND sr.status = 'published' LIMIT 1`,
      [id]
    )
    if (rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Release not found or not published' })
    }
    return await buildReleasePayload(query as any, id as string, rows[0])
  } catch (e: any) {
    if (e.statusCode === 404) throw e
    throw createError({ statusCode: 500, statusMessage: 'Database error' })
  }
})
