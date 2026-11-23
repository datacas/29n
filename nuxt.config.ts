// https://nuxt.com/docs/api/configuration/nuxt-config
// DEPLOY_TARGET=public: build para internet. Solo incluye la encuesta, los programas y las estadísticas anónimas:
// sin panel de administración, sin acceso por correo, sin subida de documentos ni rutas que lean la base de datos.
const publicBuild = process.env.DEPLOY_TARGET === 'public'
// Páginas y capas del panel de administración (no se incluyen en el build público).
// Las rutas del servidor no se pueden excluir del paquete, así que las bloquea app/server/middleware/01-public-lockdown.ts.
const ADMIN_ONLY = ['**/pages/admin/**', '**/layouts/admin.vue', '**/layouts/plain.vue', '**/middleware/admin-*.ts']

export default defineNuxtConfig({
  ignore: publicBuild ? ADMIN_ONLY : [],

  // Páginas que no cambian se generan en el build; la encuesta es una aplicación del navegador (guarda todo en IndexedDB).
  routeRules: {
    ...(publicBuild ? { '/': { prerender: true }, '/metodologia': { prerender: true }, '/programas': { prerender: true } } : {}),
    '/survey/**': { ssr: false },
    '/history': { ssr: false }
  },

  srcDir: 'app/',
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  nitro: {
    port: 3099,
    prerender: publicBuild ? { crawlLinks: false, routes: ['/', '/metodologia', '/programas'] } : undefined,
    // En Vercel la compresión la hace su red: no duplicamos cada fichero (los PDF pesan 163 MB)
    compressPublicAssets: publicBuild ? false : { gzip: true, brotli: true },
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
    '@nuxtjs/i18n'
  ],

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
    statsReleaseIds: process.env.NUXT_STATS_RELEASE_IDS || '',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || ''
  },

  css: ['~/assets/css/app.css', '~/assets/css/admin.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: '29N',
      meta: [
        { name: 'description', content: 'Cuestionarios de afinidad basados en evidencia documental' }
      ]
    }
  }
})
