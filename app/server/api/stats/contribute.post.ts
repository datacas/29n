import { query } from '~/server/utils/db'
import { releaseAllowed, releaseKeys, rateLimited } from '~/server/utils/stats'

/**
 * Aportación anónima a las estadísticas públicas. Solo llega si la persona lo acepta al terminar.
 * No se guarda una fila por persona: cada dato suma 1 a un contador (pregunta+respuesta, partido+tramo de afinidad...),
 * así que es imposible saber qué respondió alguien en concreto. Sin IP, sin agente de usuario, sin fecha por persona.
 */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MODES = new Set(['quick', 'normal', 'deep', 'total'])
const MAX_ITEMS = 300

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'x'
  // Más estricto que los eventos de uso (una aportación por encuesta terminada), pero con margen para redes compartidas
  if (rateLimited(`c:${ip}`, 10)) { setResponseStatus(event, 429); return { ok: false } }

  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object' || !ID.test(String(body.releaseId ?? ''))) {
    setResponseStatus(event, 400); return { ok: false }
  }
  if (!(await releaseAllowed(body.releaseId))) { setResponseStatus(event, 404); return { ok: false } }
  const keys = await releaseKeys(body.releaseId)
  if (!keys) { setResponseStatus(event, 202); return { ok: false } }
  const rows: [string, string, number][] = [['total', '', 0]]
  if (MODES.has(body.mode)) rows.push(['mode', body.mode, 0])

  const seenQ = new Set<string>()
  for (const a of Array.isArray(body.answers) ? body.answers.slice(0, MAX_ITEMS) : []) {
    if (!a || !ID.test(String(a.questionId)) || !keys.q.has(a.questionId) || seenQ.has(a.questionId)) continue
    const v = a.skipped ? 99 : a.value
    if (v !== 99 && !(Number.isInteger(v) && v >= -2 && v <= 2)) continue
    seenQ.add(a.questionId); rows.push(['answer', a.questionId, v])
  }
  const seenE = new Set<string>()
  for (const r of Array.isArray(body.affinity) ? body.affinity.slice(0, 60) : []) {
    if (!r || !ID.test(String(r.entityId)) || !keys.e.has(r.entityId) || seenE.has(r.entityId)) continue
    const p = r.percent
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100) continue
    seenE.add(r.entityId); rows.push(['affinity', r.entityId, Math.min(10, Math.floor(p / 10))])
  }
  if (ID.test(String(body.top ?? '')) && seenE.has(body.top)) rows.push(['top', body.top, 0])
  if (rows.length < 2) { setResponseStatus(event, 400); return { ok: false } }

  try {
    // Un solo INSERT ... ON CONFLICT con todas las filas: o suma todo o no suma nada
    const params: unknown[] = [body.releaseId]
    const values = rows.map(([k, key, v], i) => {
      params.push(k, key, v)
      return `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, 1)`
    })
    await query(
      `INSERT INTO contribution_tallies (release_id, kind, key, value, n) VALUES ${values.join(',')}
       ON CONFLICT (release_id, kind, key, value) DO UPDATE SET n = contribution_tallies.n + 1`,
      params
    )
    return { ok: true }
  } catch {
    setResponseStatus(event, 202); return { ok: false }
  }
})
