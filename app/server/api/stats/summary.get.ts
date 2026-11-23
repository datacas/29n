import { query } from '~/server/utils/db'
import { MIN_PUBLIC_COUNT, releaseAllowed } from '~/server/utils/stats'

/**
 * Estadísticas públicas de una encuesta. Todo son recuentos agregados y cualquier cifra que se apoye en menos de
 * MIN_PUBLIC_COUNT personas se oculta (se devuelve null), para que nadie pueda deducir lo que respondió otra persona.
 * Se cachea unos minutos en la red de Vercel.
 */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const k = (n: number) => (n >= MIN_PUBLIC_COUNT ? n : null)

export default defineEventHandler(async (event) => {
  const releaseId = String(getQuery(event).release ?? '')
  if (!ID.test(releaseId)) { setResponseStatus(event, 400); return { ok: false } }
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  try {
    if (!(await releaseAllowed(releaseId))) { setResponseStatus(event, 404); return { ok: false } }
    const [usage, days, modes, devices, tallies] = await Promise.all([
      query(`SELECT event, COUNT(*)::int AS n FROM usage_events WHERE release_id = $1 GROUP BY event`, [releaseId]),
      query(`SELECT to_char(created_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS day,
                    COUNT(*) FILTER (WHERE event='survey_started')::int AS started,
                    COUNT(*) FILTER (WHERE event='survey_completed')::int AS completed
               FROM usage_events WHERE release_id = $1 GROUP BY 1 ORDER BY 1 DESC LIMIT 60`, [releaseId]),
      query(`SELECT props->>'mode' AS key, COUNT(*)::int AS n FROM usage_events
              WHERE release_id = $1 AND event='survey_completed' AND props ? 'mode' GROUP BY 1`, [releaseId]),
      query(`SELECT props->>'device' AS key, COUNT(*)::int AS n FROM usage_events
              WHERE release_id = $1 AND event='survey_started' AND props ? 'device' GROUP BY 1`, [releaseId]),
      query(`SELECT kind, key, value, n FROM contribution_tallies WHERE release_id = $1`, [releaseId])
    ])
    const t = Object.fromEntries(usage.rows.map((r: any) => [r.event, r.n]))
    const started = t.survey_started ?? 0
    const completed = t.survey_completed ?? 0

    let contributions = 0
    const answers: Record<string, Record<string, number>> = {}
    const affinity: Record<string, number[]> = {}
    const top: Record<string, number> = {}
    for (const r of tallies.rows as any[]) {
      if (r.kind === 'total') contributions = r.n
      else if (r.kind === 'answer') (answers[r.key] ??= {})[r.value] = r.n
      else if (r.kind === 'affinity') (affinity[r.key] ??= Array(11).fill(0))[r.value] = r.n
      else if (r.kind === 'top') top[r.key] = r.n
    }
    const enough = contributions >= MIN_PUBLIC_COUNT

    // Por pregunta: solo si al menos MIN_PUBLIC_COUNT personas la vieron; los recuentos pequeños se ocultan
    const questions = enough
      ? Object.entries(answers).flatMap(([questionId, byValue]) => {
          const total = Object.values(byValue).reduce((a, b) => a + b, 0)
          if (total < MIN_PUBLIC_COUNT) return []
          const counts: Record<string, number | null> = {}
          for (const v of ['-2', '-1', '0', '1', '2', '99']) counts[v] = k(byValue[v as any] ?? 0) ?? (byValue[v as any] ? null : 0)
          return [{ questionId, total, counts }]
        })
      : []

    // Afinidad: media aproximada (centro de cada tramo) y reparto por tramos, por partido
    const parties = enough
      ? Object.entries(affinity).flatMap(([entityId, buckets]) => {
          const total = buckets.reduce((a, b) => a + b, 0)
          if (total < MIN_PUBLIC_COUNT) return []
          const mean = buckets.reduce((s, n, i) => s + n * Math.min(100, i * 10 + 5), 0) / total
          return [{ entityId, total, mean: Math.round(mean), top: k(top[entityId] ?? 0), buckets: buckets.map((n) => k(n) ?? (n ? null : 0)) }]
        })
      : []

    return {
      ok: true,
      minCount: MIN_PUBLIC_COUNT,
      // La página y sus enlaces solo aparecen cuando al menos MIN_PUBLIC_COUNT personas han terminado la encuesta
      visible: completed >= MIN_PUBLIC_COUNT,
      started: k(started), completed: k(completed),
      completionRate: started >= MIN_PUBLIC_COUNT ? Math.round((completed / started) * 100) : null,
      contributions: k(contributions),
      days: days.rows.map((d: any) => ({ day: d.day, started: k(d.started), completed: k(d.completed) })),
      modes: modes.rows.map((m: any) => ({ key: m.key, n: k(m.n) })),
      devices: devices.rows.map((m: any) => ({ key: m.key, n: k(m.n) })),
      questions,
      parties
    }
  } catch {
    setResponseStatus(event, 503); return { ok: false }
  }
})
