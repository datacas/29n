import { fileURLToPath } from 'node:url'
// https://nuxt.com/docs/api/configuration/nuxt-config
// DEPLOY_TARGET=public: build para internet. Solo incluye la encuesta, los programas y las estadísticas anónimas:
// sin panel de administración, sin acceso por correo, sin subida de documentos ni rutas que lean la base de datos.
const publicBuild = process.env.DEPLOY_TARGET === 'public'
// Dirección pública de la web, para las vistas previas al compartir (las etiquetas og:image deben ser absolutas)
const siteUrl = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
// Páginas y capas del panel de administración (no se incluyen en el build público).
// Las rutas del servidor no se pueden excluir del paquete, así que las bloquea app/server/middleware/01-public-lockdown.ts.
const ADMIN_ONLY = ['**/pages/admin/**', '**/layouts/admin.vue', '**/layouts/plain.vue', '**/middleware/admin-*.ts']

export default defineNuxtConfig({
  ignore: publicBuild ? ADMIN_ONLY : [],

  // Páginas que no cambian se generan en el build; la encuesta es una aplicación del navegador (guarda todo en IndexedDB).
  routeRules: {
    ...(publicBuild ? { '/': { prerender: true }, '/metodologia': { prerender: true }, '/programas': { prerender: true }, '/historia': { prerender: true } } : {}),
    '/survey/**': { ssr: false },
    '/history': { ssr: false },
    '/estadisticas': { ssr: false }
  },

  srcDir: 'app/',
  // Nuxt 4 busca server/ y public/ en la raíz: aquí viven dentro de app/
  serverDir: 'app/server',
  dir: { public: 'app/public' },
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  nitro: {
    port: 3099,
    prerender: publicBuild ? { crawlLinks: false, routes: ['/', '/metodologia', '/programas', '/historia'] } : undefined,
    // En Vercel la compresión la hace su red: no duplicamos cada fichero (los PDF pesan 163 MB)
    compressPublicAssets: publicBuild ? false : { gzip: true, brotli: true },
    // Versiones congeladas como recurso del servidor (para validar las aportaciones anónimas)
    serverAssets: [{ baseName: 'releases', dir: fileURLToPath(new URL('./app/public/data/releases', import.meta.url)) }],
    storage: {
      data: {
        driver: 'fs',
        base: './data'
      }
    },
    experimental: {
      openAPI: false
    },
    routeRules: {
      // El manifiesto debe revalidarse siempre (el módulo ya hace lo mismo con sw.js): así las versiones nuevas llegan sin esperar
      '/manifest.webmanifest': { headers: { 'Cache-Control': 'no-cache' } },
      '/_nuxt/**': {
        headers: {
          // Los ficheros llevan hash en el nombre: se pueden revalidar con ETag (304) en vez de bajarlos siempre
          'Cache-Control': 'public, no-cache'
        }
      }
    }
  },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@vite-pwa/nuxt'
  ],

  // PWA: instalable y con la encuesta disponible sin conexión. El service worker propio está en service-worker/sw.ts
  pwa: {
    strategies: 'buildSW',
    // Con aviso: no se recarga la página en mitad de una encuesta sin que la persona lo decida
    registerType: 'prompt',
    scope: '/',
    manifest: {
      id: '/',
      name: '29N · ¿Con qué programa coincides más?',
      short_name: '29N',
      description: 'Compara tu opinión con los programas electorales del 29 de noviembre. Cada porcentaje se apoya en una cita del programa, con su página.',
      lang: 'es',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'any',
      background_color: '#fafaf8',
      theme_color: '#fafaf8',
      categories: ['education', 'politics', 'news'],
      launch_handler: { client_mode: 'navigate-existing' },
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      shortcuts: [
        { name: 'Encuesta 29N', short_name: '29N', url: '/', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        { name: 'Historia', short_name: 'Historia', url: '/historia', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        { name: 'Mis resultados', short_name: 'Resultados', url: '/history', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] }
      ],
      screenshots: [
        { src: '/screenshots/movil-inicio.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Portada: contesta unas preguntas y compara con los programas' },
        { src: '/screenshots/movil-partidos.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Elige los partidos y la profundidad' },
        { src: '/screenshots/escritorio-inicio.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Portada en el ordenador' }
      ]
    },
    buildSW: {
      swSrc: 'service-worker/sw.ts',
      // Solo el «shell»: los datos de cada encuesta, los PDF y las capturas se guardan al usarlos (ver el service worker)
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      // Del HTML solo se precarga offline.html: las páginas las guarda el service worker al visitarlas
      globIgnores: ['data/**', 'programas/**', 'screenshots/**', 'og.png', 'icon-maskable-*.png', '**/*.map', '**/index.html', '200.html', '404.html'],
      // Sin transformaciones: el módulo quitaría «.html» de las URL y /offline daría 404 (rompería la instalación)
      manifestTransforms: [async (entries: any[]) => ({ manifest: entries, warnings: [] })],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
    },
    client: { installPrompt: true, periodicSyncForUpdates: 3600 },
    devOptions: { enabled: false }
  },

  i18n: {
    locales: [
      { code: 'es', name: 'Español', file: 'es.json' }
    ],
    defaultLocale: 'es',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    },
    langDir: 'locales/'
  },

  ssr: true,
  // Sitio estático: el payload va incrustado en el HTML. Si no, el navegador pide /_payload.json y Vercel responde 404
  experimental: { payloadExtraction: !publicBuild },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity',
    storagePath: process.env.STORAGE_PATH || './storage',
    workerScript: process.env.WORKER_SCRIPT || './services/document-worker/extract.py',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
    brevoSenderName: process.env.BREVO_SENDER_NAME || 'Admin',
    brevoTemplateId: process.env.BREVO_TEMPLATE_ID || '',
    adminEmail: process.env.ADMIN_EMAIL || '',
    otpSecret: process.env.OTP_SECRET || '',
    publicBuild,
    public: {
      webAnalytics: process.env.NUXT_PUBLIC_WEB_ANALYTICS === '1',
      // Botón «Invítame a un café». Vacío = no se muestra
      kofiUrl: process.env.NUXT_PUBLIC_KOFI_URL ?? 'https://ko-fi.com/datacas'
    },
    statsReleaseIds: process.env.NUXT_STATS_RELEASE_IDS || '',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || ''
  },

  css: ['~/assets/css/app.css', '~/assets/css/admin.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      charset: 'utf-8',
      // viewport-fit=cover: la app instalada ocupa toda la pantalla; el CSS respeta las zonas seguras con env(safe-area-inset-*)
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      title: '29N',
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/png', href: '/favicon-32.png', sizes: '32x32' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ],
      meta: [
        { name: 'theme-color', content: '#fafaf8' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: '29N' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'description', content: 'Compara tu opinión con los programas electorales del 29 de noviembre de 2026. Cada porcentaje se apoya en una cita literal del programa, con su página.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'es_ES' },
        { property: 'og:site_name', content: '29N' },
        { property: 'og:title', content: '29N · ¿Con qué programa coincides más?' },
        { property: 'og:description', content: 'Compara tu opinión con los programas electorales del 29 de noviembre de 2026. Cada porcentaje se apoya en una cita literal del programa, con su página.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        ...(siteUrl ? [
          { property: 'og:url', content: siteUrl },
          { property: 'og:image', content: `${siteUrl}/og.png` },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { property: 'og:image:alt', content: '29N: ¿Con qué programa coincides más?' },
          { name: 'twitter:image', content: `${siteUrl}/og.png` }
        ] : [])
      ]
    }
  }
})
