<template>
  <div class="share" role="group" :aria-label="label">
    <p class="share__title">{{ label }}</p>
    <div class="share__row">
      <!-- Móvil (y escritorios que lo admiten): la hoja nativa del sistema, con WhatsApp, correo y todo lo que tenga instalado -->
      <button v-if="canNativeShare" type="button" class="btn btn-primary share__native" @click="nativeShare">Compartir</button>
      <template v-else>
        <a class="btn share__btn" :href="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a class="btn share__btn" :href="telegram" target="_blank" rel="noopener noreferrer">Telegram</a>
        <a class="btn share__btn" :href="x" target="_blank" rel="noopener noreferrer">X</a>
        <a class="btn share__btn" :href="facebook" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a class="btn share__btn" :href="mail">Correo</a>
      </template>
      <button type="button" class="btn share__btn" @click="copy">Copiar enlace</button>
    </div>
    <p class="share__status small" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ text: string; label?: string; title?: string }>(), {
  label: 'Compártelo',
  title: '29N'
})

// La dirección compartida es siempre la de la web, nunca la de la pantalla de resultados: los resultados solo existen en tu navegador
const url = ref('')
const canNativeShare = ref(false)
const status = ref('')

onMounted(() => {
  url.value = `${location.origin}/`
  canNativeShare.value = typeof navigator.share === 'function'
})

const enc = encodeURIComponent
const whole = computed(() => `${props.text} ${url.value}`)
const whatsapp = computed(() => `https://wa.me/?text=${enc(whole.value)}`)
const telegram = computed(() => `https://t.me/share/url?url=${enc(url.value)}&text=${enc(props.text)}`)
const x = computed(() => `https://twitter.com/intent/tweet?text=${enc(props.text)}&url=${enc(url.value)}`)
const facebook = computed(() => `https://www.facebook.com/sharer/sharer.php?u=${enc(url.value)}`)
const mail = computed(() => `mailto:?subject=${enc(props.title)}&body=${enc(whole.value)}`)

async function nativeShare() {
  try {
    await navigator.share({ title: props.title, text: props.text, url: url.value })
  } catch (e: any) {
    // Cerrar la hoja sin elegir nada lanza AbortError: no es un fallo
    if (e?.name !== 'AbortError') status.value = 'No se pudo abrir el menú de compartir. Prueba con «Copiar enlace».'
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    status.value = 'Enlace copiado.'
  } catch {
    status.value = `Copia este enlace: ${url.value}`
  }
  setTimeout(() => { status.value = '' }, 4000)
}
</script>

<style scoped>
.share__title { font-weight: 600; margin: 0 0 var(--space-2); }
.share__row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.share__btn { min-height: 2.75rem; padding: 0.4rem 1.1rem; font-size: 0.95rem; }
.share__native { min-height: 2.9rem; padding: 0.5rem 1.4rem; font-size: 1rem; }
.share__status { min-height: 1.4rem; margin-top: var(--space-2); }
</style>
