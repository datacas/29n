/**
 * Estadísticas de uso anónimas. Solo envía recuentos agregables (modo, nº de partidos, nº de preguntas, móvil/ordenador).
 * No envía respuestas, resultados, IP ni identificadores. Respeta «No rastrear» del navegador. Nunca interrumpe la encuesta.
 */
export function track(event: 'survey_started' | 'survey_completed', releaseId: string, props: Record<string, unknown> = {}) {
  try {
    if (!import.meta.client) return
    if (navigator.doNotTrack === '1') return
    const device = window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop'
    fetch('/api/stats/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, releaseId, props: { ...props, device } }),
      keepalive: true
    }).catch(() => {})
  } catch {
    /* sin efecto */
  }
}
