<template>
  <ClientOnly>
    <p v-if="canInstall">
      <button type="button" class="btn btn--quiet install" @click="$pwa.install()">Instalar 29N como app</button>
    </p>
    <p v-else-if="iosHint" class="small">Para instalar 29N en el iPhone o iPad: toca Compartir y «Añadir a pantalla de inicio».</p>
  </ClientOnly>
</template>

<script setup lang="ts">
const { $pwa } = useNuxtApp()
const canInstall = computed(() => !!$pwa && $pwa.showInstallPrompt && !$pwa.isPWAInstalled)
// iOS no tiene botón de instalación: solo se puede explicar el gesto (y solo en Safari, fuera de la app instalada)
const iosHint = ref(false)
onMounted(() => {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  iosHint.value = ios && safari && !(navigator as any).standalone
})
</script>

<style scoped>
.install { min-height: 2.75rem; padding: 0.3rem 0.4rem; }
</style>
