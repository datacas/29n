/**
 * Build público (DEPLOY_TARGET=public): del servidor solo queda la estadística anónima de uso.
 * Cualquier otra ruta /api/** o /admin/** responde 404, aunque su código viaje en el paquete.
 */
export default defineEventHandler((event) => {
  if (!useRuntimeConfig().publicBuild) return
  const path = (event.path || '').split('?')[0]
  const isStats = path === '/api/stats/event' && event.method === 'POST'
  if ((path.startsWith('/api/') || path === '/api' || path.startsWith('/admin')) && !isStats) {
    throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
  }
})
