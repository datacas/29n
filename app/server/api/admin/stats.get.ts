import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'

/** Resumen de uso para el panel de administración. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const [tot, days, parties, modes, devices] = await Promise.all([
    query(`SELECT event, COUNT(*)::int AS n FROM usage_events GROUP BY event`),
    query(`SELECT to_char(created_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS day,
                  COUNT(*) FILTER (WHERE event='survey_started')::int AS started,
                  COUNT(*) FILTER (WHERE event='survey_completed')::int AS completed
             FROM usage_events GROUP BY 1 ORDER BY 1 DESC LIMIT 30`),
    query(`SELECT p AS party, COUNT(*)::int AS n FROM usage_events, jsonb_array_elements_text(props->'parties') p
            WHERE event='survey_started' GROUP BY 1 ORDER BY 2 DESC`),
    query(`SELECT props->>'mode' AS mode, COUNT(*)::int AS n FROM usage_events WHERE event='survey_started' AND props ? 'mode' GROUP BY 1 ORDER BY 2 DESC`),
    query(`SELECT props->>'device' AS device, COUNT(*)::int AS n FROM usage_events WHERE event='survey_started' AND props ? 'device' GROUP BY 1 ORDER BY 2 DESC`)
  ])
  const t = Object.fromEntries(tot.rows.map((r: any) => [r.event, r.n]))
  const started = t.survey_started ?? 0, completed = t.survey_completed ?? 0
  return {
    started, completed, completionRate: started ? Math.round((completed / started) * 100) : null,
    days: days.rows, parties: parties.rows, modes: modes.rows, devices: devices.rows
  }
})
