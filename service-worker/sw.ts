/// <reference lib="webworker" />
/**
 * Service worker de la PWA (estrategia buildSW de @vite-pwa/nuxt).
 *
 *  - Precarga el «shell» (JS, CSS, fuentes, iconos, página sin conexión): la app arranca sin red.
 *  - Datos de la encuesta (/data/releases/*.json): una versión nunca cambia, así que caché primero.
 *  - Páginas: red primero (3 s) y, si no hay red, la última copia. Las rutas /survey/** son una app del navegador
 *    (ssr: false): cualquier /survey/** sirve el mismo HTML, así que se reutiliza el que haya en caché.
 *  - Programas en PDF: solo se guardan los que la persona abre (pesan decenas de MB).
 *  - /api y /admin nunca se cachean, salvo el resumen público de estadísticas. Los eventos de uso y las aportaciones
 *    anónimas que fallan por falta de red se reenvían después (24 h como mucho).
 *  - Al activar una versión nueva se vacía la caché de páginas: su HTML apuntaría a ficheros ya borrados.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { RangeRequestsPlugin } from 'workbox-range-requests'

declare const self: ServiceWorkerGlobalScope

const PAGES = 'pages-v1'
const RELEASES = 'releases-v1'
const OK = new CacheableResponsePlugin({ statuses: [200] })
// El servidor comprime y añade «Vary: Accept-Encoding»: sin esto, una copia guardada con fetch() podría no encontrarse
const matchOptions = { ignoreVary: true }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(PAGES))
})

// Eventos de uso y aportaciones anónimas: si no hay red, se reintentan cuando vuelva
const statsQueue = new BackgroundSyncPlugin('stats-queue', { maxRetentionTime: 24 * 60 })
registerRoute(
  ({ url, request }) => request.method === 'POST' && (url.pathname === '/api/stats/event' || url.pathname === '/api/stats/contribute'),
  new NetworkOnly({ plugins: [statsQueue] }),
  'POST'
)

// Resumen público de estadísticas: la última copia si no hay red
registerRoute(
  ({ url }) => url.pathname === '/api/stats/summary',
  new NetworkFirst({ cacheName: 'stats-v1', networkTimeoutSeconds: 4, matchOptions, plugins: [OK, new ExpirationPlugin({ maxEntries: 6 })] })
)

// Versiones congeladas de cada encuesta
registerRoute(
  ({ url }) => /^\/data\/releases\/[0-9a-f-]{36}\.json$/.test(url.pathname),
  new CacheFirst({ cacheName: RELEASES, matchOptions, plugins: [OK, new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 365 * 24 * 3600 })] })
)

// Programas en PDF: solo los que se abren (con soporte de rangos para visores de PDF)
registerRoute(
  ({ url }) => url.pathname.startsWith('/programas/') && url.pathname.endsWith('.pdf'),
  new CacheFirst({
    cacheName: 'programas-v1',
    matchOptions,
    plugins: [OK, new RangeRequestsPlugin(), new ExpirationPlugin({ maxEntries: 8, purgeOnQuotaError: true })]
  })
)

// Páginas
const pages = new NetworkFirst({ cacheName: PAGES, networkTimeoutSeconds: 3, matchOptions, plugins: [OK, new ExpirationPlugin({ maxEntries: 40 })] })
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !/^\/(admin|api|_nuxt|__nuxt_error)(\/|$)/.test(url.pathname),
  pages
)

// Sin red y sin copia de esa página: el HTML de otra /survey/**, o la página sin conexión
setCatchHandler(async ({ request, url }) => {
  if (request.mode !== 'navigate') return Response.error()
  if (url.pathname.startsWith('/survey/')) {
    const cache = await caches.open(PAGES)
    const key = (await cache.keys()).find((r) => new URL(r.url).pathname.startsWith('/survey/'))
    const shell = key && (await cache.match(key, matchOptions))
    if (shell) return shell
  }
  return (await matchPrecache('/offline.html')) ?? Response.error()
})

self.addEventListener('message', (event) => {
  const d = event.data
  if (d?.type === 'SKIP_WAITING') self.skipWaiting()
  // La página pide guardar de antemano lo necesario para usar la encuesta sin conexión
  if (d?.type === 'WARM') event.waitUntil(warm(d.pages, d.data))
})

const safe = (u: unknown): u is string => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//')

async function warm(pageUrls: unknown, dataUrls: unknown) {
  const pagesCache = await caches.open(PAGES)
  const releases = await caches.open(RELEASES)
  const get = async (u: string, headers?: HeadersInit) => {
    const res = await fetch(u, { headers, credentials: 'same-origin' })
    return res.ok ? res : null
  }
  await Promise.allSettled([
    ...(Array.isArray(pageUrls) ? pageUrls.filter(safe) : []).map(async (u) => {
      const res = await get(u, { accept: 'text/html' })
      if (res) await pagesCache.put(u, res)
    }),
    ...(Array.isArray(dataUrls) ? dataUrls.filter(safe) : []).map(async (u) => {
      if (await releases.match(u, matchOptions)) return
      const res = await get(u)
      if (res) await releases.put(u, res)
    })
  ])
}
