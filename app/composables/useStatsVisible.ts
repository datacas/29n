/**
 * ¿Se enseñan ya las estadísticas públicas? Solo cuando al menos 10 personas han terminado la encuesta,
 * para no mostrar una página casi vacía. Se pregunta una vez por visita (la respuesta está cacheada en la red).
 */
export function useStatsVisible() {
  const visible = useState<boolean>('stats-visible', () => false)
  const asked = useState<boolean>('stats-visible-asked', () => false)
  if (import.meta.client && !asked.value) {
    asked.value = true
    import('~/data/surveys.json').then(async ({ default: surveys }: any) => {
      const id = (surveys?.find((s: any) => s.kind !== 'historical') ?? surveys?.[0])?.release_id
      if (!id) return
      const r = await fetch(`/api/stats/summary?release=${id}`)
      if (r.ok) visible.value = !!(await r.json()).visible
    }).catch(() => {})
  }
  return visible
}
