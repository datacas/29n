/**
 * Aportación voluntaria y anónima a las estadísticas públicas. Solo se llama si la persona lo acepta.
 * Envía respuestas (-2..2, o «No sé»), la afinidad con cada partido y cuál sale primero, sin ningún identificador.
 * El servidor solo suma contadores: no guarda una fila por persona.
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
