import { createI18n } from 'vue-i18n'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  
  const i18n = createI18n({
    legacy: false,
    locale: 'es',
    fallbackLocale: 'es',
    messages: {
      es: {}
    }
  })

  nuxtApp.vueApp.use(i18n)
})
