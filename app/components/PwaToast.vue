<template>
  <ClientOnly>
    <div class="pwa" aria-live="polite">
      <p v-if="offline" class="pwa__offline" role="status">Sin conexión. Puedes seguir: tus respuestas se guardan en tu navegador.</p>
      <div v-if="$pwa?.needRefresh" class="pwa__toast" role="alert">
        <span>Hay una versión nueva de 29N. Tus respuestas no se pierden al actualizar.</span>
        <span class="pwa__actions">
          <button type="button" class="btn-primary" @click="$pwa.updateServiceWorker(true)">Actualizar</button>
          <button type="button" class="btn btn--quiet" @click="$pwa.cancelPrompt()">Luego</button>
        </span>
      </div>
      <p v-else-if="ready" class="pwa__toast pwa__toast--ready" role="status">Ya puedes usar 29N sin conexión.</p>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import surveysJson from '~/data/surveys.json'

const { $pwa } = useNuxtApp()
const buildId = useRuntimeConfig().app.buildId
const offline = ref(false)
const ready = ref(false)

function sync() { offline.value = !navigator.onLine }

// Guarda de antemano lo necesario para hacer la encuesta sin conexión (salvo con «ahorro de datos»)
function warmUp(reg: ServiceWorkerRegistration) {
  if ((navigator as any).connection?.saveData) return
  const surveys = surveysJson as any[]
  const key = `${buildId}:${surveys.map((s) => s.release_id).join(',')}`
  try { if (localStorage.getItem('pwa-warm') === key) return } catch { /* sin almacenamiento: se repite, no pasa nada */ }
  reg.active?.postMessage({
    type: 'WARM',
    pages: ['/', '/metodologia', '/programas', '/history', ...(surveys.some((s) => s.kind === 'historical') ? ['/historia'] : []), ...surveys.map((s) => `/survey/${s.release_id}/start`)],
    data: surveys.map((s) => `/data/releases/${s.release_id}.json`)
  })
  try { localStorage.setItem('pwa-warm', key) } catch { /* idem */ }
}

onMounted(() => {
  sync()
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
  if (!('serviceWorker' in navigator) || !$pwa) return
  navigator.serviceWorker.ready.then((reg) => {
    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 3000))
    idle(() => warmUp(reg))
  })
})
onBeforeUnmount(() => {
  window.removeEventListener('online', sync)
  window.removeEventListener('offline', sync)
})

// «Listo sin conexión»: aviso breve, solo la primera vez que se instala el service worker
watch(() => $pwa?.offlineReady, (v) => {
  if (!v) return
  ready.value = true
  setTimeout(() => { ready.value = false; $pwa?.cancelPrompt() }, 6000)
})
</script>

<style scoped>
.pwa { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: grid; gap: var(--space-2); justify-items: center; padding: 0 var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom)); pointer-events: none; }
.pwa > * { pointer-events: auto; width: min(100%, 36rem); margin: 0; }
.pwa__offline, .pwa__toast { background: var(--ink); color: #fff; border-radius: 16px; padding: var(--space-3) var(--space-4); font-size: var(--step--1); box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); }
.pwa__toast { display: grid; gap: var(--space-3); }
.pwa__actions { display: flex; gap: var(--space-3); align-items: center; }
.pwa__toast .btn-primary { background: #fff; color: var(--ink); min-height: 2.5rem; padding: 0 1.1rem; }
.pwa__toast .btn--quiet { color: #fff; }
.pwa__offline { text-align: center; }
</style>
