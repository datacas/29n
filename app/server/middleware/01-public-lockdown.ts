/**
 * Build público (DEPLOY_TARGET=public): del servidor solo quedan las estadísticas anónimas (registro de uso, aportaciones y resumen público).
 * Cualquier otra ruta /api/** o /admin/** responde 404, aunque su código viaje en el paquete.
 */
export default defineEventHandler((event) => {
  if (!useRuntimeConfig().publicBuild) return
  const path = (event.path || '').split('?')[0]
  const isStats = (event.method === 'POST' && (path === '/api/stats/event' || path === '/api/stats/contribute'))
    || (event.method === 'GET' && path === '/api/stats/summary')
  if ((path.startsWith('/api/') || path === '/api' || path.startsWith('/admin')) && !isStats) {
    throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
  }
})
