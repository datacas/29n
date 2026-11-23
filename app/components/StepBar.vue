<template>
  <ol class="steps" aria-label="Pasos de la encuesta">
    <li v-for="(s, i) in steps" :key="s" :class="{ done: i + 1 < current }" :aria-current="i + 1 === current ? 'step' : undefined">
      {{ s }}<span v-if="i + 1 < current" class="visually-hidden"> (hecho)</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{ current: 1 | 2 | 3 | 4 }>()
const steps = ['Partidos', 'Prioridades', 'Preguntas', 'Resultados']
</script>
