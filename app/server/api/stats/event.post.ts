import { query } from '~/server/utils/db'

/**
 * Registro anónimo de uso. No guarda IP ni agente de usuario ni identificadores.
 * Valida con lista cerrada y limita la frecuencia en memoria (la IP no se almacena en ningún sitio).
 */
const EVENTS = new Set(['survey_started', 'survey_completed'])
const MODES = new Set(['quick', 'normal', 'deep'])
const DEVICES = new Set(['mobile', 'desktop'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const hits = new Map<string, { n: number; t: number }>()
function limited(key: string): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now - h.t > 60_000) { hits.set(key, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false }
  h.n++
  return h.n > 20
}
const num = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null)

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'x'
  if (limited(ip)) { setResponseStatus(event, 429); return { ok: false } }

  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object' || !EVENTS.has(body.event) || !UUID.test(String(body.releaseId ?? ''))) {
    setResponseStatus(event, 400); return { ok: false }
  }
  const p = (body.props && typeof body.props === 'object' ? body.props : {}) as Record<string, unknown>
  const props: Record<string, unknown> = {}
  if (MODES.has(p.mode as string)) props.mode = p.mode
  if (DEVICES.has(p.device as string)) props.device = p.device
  for (const k of ['questionCount', 'answered', 'skipped', 'partiesCount'] as const) {
    const v = num(p[k], 500); if (v !== null) props[k] = v
  }
  if (Array.isArray(p.parties)) {
    props.parties = p.parties.filter((x) => typeof x === 'string' && x.length <= 40).slice(0, 40)
  }
  try {
    // Si NUXT_STATS_RELEASE_IDS está definida (lista separada por comas), solo se aceptan esas encuestas.
    // Si no, se comprueba contra la tabla de releases (instalación completa con base de datos local).
    const allow = String(useRuntimeConfig().statsReleaseIds || '').split(',').map((x) => x.trim()).filter(Boolean)
    if (allow.length) {
      if (!allow.includes(String(body.releaseId))) { setResponseStatus(event, 404); return { ok: false } }
    } else {
      const { rows } = await query(`SELECT 1 FROM survey_releases WHERE id = $1 AND status = 'published'`, [body.releaseId])
      if (!rows.length) { setResponseStatus(event, 404); return { ok: false } }
    }
    await query(`INSERT INTO usage_events (event, release_id, props) VALUES ($1, $2, $3::jsonb)`, [body.event, body.releaseId, JSON.stringify(props)])
    return { ok: true }
  } catch {
    // La estadística nunca debe estropear la encuesta: si la base no responde, se descarta el evento sin error visible
    setResponseStatus(event, 202); return { ok: false }
  }
})
