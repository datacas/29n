<template>
  <ol class="steps" aria-label="Pasos de la encuesta">
    <li v-for="(s, i) in steps" :key="s" :class="{ done: i + 1 < current }" :aria-current="i + 1 === current ? 'step' : undefined">
      {{ s }}<span v-if="i + 1 < current" class="visually-hidden"> (hecho)</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
// El primer paso se llama como las entidades de la encuesta («Partidos» en el 29N, «Programas» en la histórica).
// Lo pasa cada página, que ya tiene ese dato: el componente no vuelve a descargar la versión.
const props = withDefaults(defineProps<{ current: 1 | 2 | 3 | 4; entities?: string }>(), { entities: 'partidos' })
const steps = computed(() => [props.entities.charAt(0).toUpperCase() + props.entities.slice(1), 'Prioridades', 'Preguntas', 'Resultados'])
</script>
