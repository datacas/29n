import { query } from '~/server/utils/db'

/** Límite de frecuencia en memoria por clave (la IP no se guarda en ningún sitio). */
const hits = new Map<string, { n: number; t: number }>()
export function rateLimited(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false }
  h.n++
  return h.n > max
}

/**
 * ¿Se aceptan estadísticas de esta encuesta? Con NUXT_STATS_RELEASE_IDS (lista separada por comas) solo esas;
 * si no, las publicadas en la base local.
 */
export async function releaseAllowed(releaseId: string): Promise<boolean> {
  const allow = allowedReleaseIds()
  if (allow.length) return allow.includes(releaseId)
  const { rows } = await query(`SELECT 1 FROM survey_releases WHERE id = $1 AND status = 'published'`, [releaseId])
  return rows.length > 0
}

export function allowedReleaseIds(): string[] {
  return String(useRuntimeConfig().statsReleaseIds || '').split(',').map((x) => x.trim()).filter(Boolean)
}

/** Ningún dato público se apoya en menos personas que esto. */
export const MIN_PUBLIC_COUNT = 10

/**
 * Identificadores válidos (preguntas y partidos) de una versión. Las aportaciones solo suman claves que existen
 * en la versión publicada: así nadie puede inflar la tabla con identificadores inventados.
 * Build público: lee el JSON congelado empaquetado como recurso del servidor. Local: la base de datos.
 */
const keysCache = new Map<string, { q: Set<string>; e: Set<string> } | null>()
export async function releaseKeys(releaseId: string): Promise<{ q: Set<string>; e: Set<string> } | null> {
  if (keysCache.has(releaseId)) return keysCache.get(releaseId)!
  let keys: { q: Set<string>; e: Set<string> } | null = null
  try {
    if (useRuntimeConfig().publicBuild) {
      const d = await useStorage('assets:releases').getItem<any>(`${releaseId}.json`)
      if (d?.questions) keys = { q: new Set(d.questions.map((x: any) => x.questionId)), e: new Set(d.entities.map((x: any) => x.entityId)) }
    } else {
      const q = await query(`SELECT question_id::text AS id FROM release_questions WHERE release_id = $1`, [releaseId])
      const e = await query(`SELECT entity_id::text AS id FROM release_entities WHERE release_id = $1`, [releaseId])
      if (q.rows.length) keys = { q: new Set(q.rows.map((r: any) => r.id)), e: new Set(e.rows.map((r: any) => r.id)) }
    }
  } catch { keys = null }
  if (keys) keysCache.set(releaseId, keys)
  return keys
}
