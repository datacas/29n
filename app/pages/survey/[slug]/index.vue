<template>
  <div class="wrap detail">
    <p class="small" role="status">Abriendo el test…</p>
    <p><NuxtLink :to="`/survey/${releaseId}/start`" class="btn-primary">{{ $t('survey.detail.start') }}</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
// La ficha de la encuesta ya no tiene pantalla propia: la portada y «Elegir partidos» cumplen su función.
const route = useRoute()
const releaseId = (route.params.slug || route.params.id || '') as string
await navigateTo(`/survey/${releaseId}/start`, { replace: true })
</script>

<style scoped>
.detail { padding-top: var(--space-6); display: grid; gap: var(--space-4); }
</style>
