<template>
  <div class="hist">
    <section class="band on-band">
      <div class="wrap band__inner">
        <h1>Historia</h1>
        <p>Compara tu opinión con programas políticos del pasado. Es un test aparte: no tiene nada que ver con las elecciones del 29 de noviembre.</p>
      </div>
    </section>

    <div class="wrap stack-lg hist__body">
      <p class="note"><strong>Son textos de hace casi un siglo.</strong> Coincidir con una propuesta concreta no equivale a compartir ese régimen ni sus crímenes. Cada resultado trae una ficha con lo que pasó después.</p>

      <p v-if="!historical.length" class="note" role="status">Todavía no hay ningún test histórico publicado.</p>

      <section v-for="h in historical" :key="h.release_id" class="label" :aria-labelledby="`h-${h.release_id}`">
        <div class="label__head"><h2 :id="`h-${h.release_id}`">{{ h.title }}</h2><span class="meta">v{{ h.release_version }}</span></div>
        <div class="label__body stack">
          <p>{{ h.description }}</p>
          <div><NuxtLink :to="`/survey/${h.release_id}/start`" class="btn-primary">Empezar</NuxtLink></div>
        </div>
      </section>

      <p class="small">Cómo se eligieron los textos, las preguntas y las citas: <NuxtLink to="/metodologia">Cómo funciona</NuxtLink>.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import surveysJson from '~/data/surveys.json'
const historical = (surveysJson as any[]).filter((s) => s.kind === 'historical')
useHead({ title: '29N · Historia' })
</script>

<style scoped>
.hist__body { padding-top: var(--space-5); padding-bottom: var(--space-6); }
</style>
