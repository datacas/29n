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
