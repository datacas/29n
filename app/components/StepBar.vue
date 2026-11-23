<template>
  <ol class="steps" aria-label="Pasos de la encuesta">
    <li v-for="(s, i) in steps" :key="s" :class="{ done: i + 1 < current }" :aria-current="i + 1 === current ? 'step' : undefined">
      {{ s }}<span v-if="i + 1 < current" class="visually-hidden"> (hecho)</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{ current: 1 | 2 | 3 | 4 }>()
// El primer paso se llama como las entidades de la encuesta («Partidos» en el 29N, «Programas» en la histórica).
// Misma URL que la página: useFetch reutiliza la respuesta, no hace otra petición.
const route = useRoute()
const id = String(route.params.slug || route.params.id || '')
const { data } = useFetch<any>(`/data/releases/${id}.json`, { key: `release-${id}`, server: false, immediate: !!id })
const steps = computed(() => {
  const plural = data.value?.consultation?.entityNoun?.plural ?? 'partidos'
  return [plural.charAt(0).toUpperCase() + plural.slice(1), 'Prioridades', 'Preguntas', 'Resultados']
})
</script>
