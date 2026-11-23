/**
 * Aportación anónima a las estadísticas públicas. Se envía sola al ver el resultado (una vez por encuesta terminada),
 * salvo que el navegador pida no ser rastreado (privacyOptOut). Envía respuestas (-2..2, o «No sé»), la afinidad
 * con cada entidad y cuál sale primero, sin ningún identificador. El servidor solo suma contadores: no guarda
 * una fila por persona.
 */
export async function contribute(payload: {
  releaseId: string
  mode?: string
  answers: { questionId: string; value: number; skipped?: boolean }[]
  affinity: { entityId: string; percent: number }[]
  top?: string | null
}): Promise<boolean> {
  try {
    const r = await fetch('/api/stats/contribute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    })
    return r.ok
  } catch {
    return false
  }
}
