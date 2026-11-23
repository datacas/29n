// Visitas con Vercel Web Analytics: solo páginas vistas, sin cookies. Se activa con NUXT_PUBLIC_WEB_ANALYTICS=1 (solo en producción)
// y no se carga si la persona tiene activado «No rastrear» o el control global de privacidad.
export default defineNuxtPlugin(() => {
  if (!useRuntimeConfig().public.webAnalytics) return
  const nav = navigator as any
  const dnt = nav.doNotTrack === '1' || (window as any).doNotTrack === '1' || nav.msDoNotTrack === '1'
  if (dnt || nav.globalPrivacyControl === true) return
  const w = window as any
  w.va = w.va || function () { (w.vaq = w.vaq || []).push(arguments) }
  const s = document.createElement('script')
  s.defer = true
  s.src = '/_vercel/insights/script.js'
  document.head.appendChild(s)
})
