<template>
  <div class="calibration-quick">
    <section class="band on-band">
      <div class="wrap band__inner">
        <NuxtLink :to="`/survey/${releaseId}/start`" class="back back--band">&larr; {{ $t('common.back') }}</NuxtLink>
        <h1>{{ $t('scoring.calibration.title') }}</h1>
        <p class="description">Asigna importancia a cada tema. Esto ajusta cuánto pesa cada uno en tu resultado.</p>
      </div>
    </section>
    <div class="wrap stack-lg cq__body">
      <StepBar :current="2" :entities="progress?.entityNounPlural" />
      <p v-if="!progress" class="note note--alert error" role="alert">No se encontró el progreso del test. <NuxtLink :to="`/survey/${releaseId}/start`">Comenzar de nuevo</NuxtLink></p>
      <section v-else class="label" aria-labelledby="h-temas">
        <div class="label__head"><h2 id="h-temas">Importancia de cada tema</h2></div>
        <div class="dimensions-list">
          <div v-for="dim in progress.dimensions" :key="dim.dimensionId" class="dimension-item cq__row">
            <label :for="`dim-${dim.dimensionId}`" class="cq__name">{{ dim.name }}<span v-if="dimensionHelp(dim.code)" class="cq__hint">{{ dimensionHelp(dim.code) }}</span></label>
            <select :id="`dim-${dim.dimensionId}`" v-model="importanceMap[dim.dimensionId]" class="importance-select cq__select">
              <option value="low">{{ $t('survey.take.importance.low') }}</option>
              <option value="medium">{{ $t('survey.take.importance.medium') }}</option>
              <option value="high">{{ $t('survey.take.importance.high') }}</option>
            </select>
          </div>
        </div>
      </section>
    </div>
    <div v-if="progress" class="dock actions">
      <div class="dock__inner">
        <NuxtLink :to="`/survey/${releaseId}/questions`" class="btn-primary btn--block">Comenzar test</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { dimensionHelp } from '~/lib/survey/dimension-help'
const route = useRoute()
const releaseId = (route.params.slug || route.params.id || '') as string

const { getProgress, saveProgress: persistToDb } = await import('~/lib/storage/indexeddb')
const progress = await getProgress(releaseId)

if (!progress) {
  navigateTo(`/survey/${releaseId}/start`)
}

const importanceMap = ref<Record<string, 'low' | 'medium' | 'high'>>({})

// Initialize all dimensions to medium
for (const dim of progress?.dimensions || []) {
  importanceMap.value[dim.dimensionId] = 'medium'
}

// Watch for changes and save weights
watch(importanceMap, (newMap) => {
  if (!progress) return
  
  // Convert low/medium/high to numeric weights
  const weightMap: Record<string, number> = { low: 0.5, medium: 1.0, high: 2.0 }
  const weights: Record<string, number> = {}
  
  let total = 0
  for (const [dimId, importance] of Object.entries(newMap)) {
    weights[dimId] = weightMap[importance] || 1.0
    total += weightMap[importance] || 1.0
  }
  
  // Normalize to sum to 1
  for (const dimId of Object.keys(weights)) {
    weights[dimId] = Math.round((weights[dimId] / total) * 10000) / 10000
  }
  
  progress.calibrationWeights = weights
  progress.calibrationMode = 'quick'
  persistToDb(progress)
}, { deep: true })
</script>

<style scoped>
.cq__body { padding-top: var(--space-5); padding-bottom: var(--space-6); }
.back--band { color: var(--muted); margin-bottom: var(--space-2); }
.cq__row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); }
.cq__row:last-child { border-bottom: 0; }
.cq__name { flex: 1; font-weight: 700; font-size: 1.1rem; }
.cq__hint { display: block; margin-top: 0.2rem; font-size: 0.85rem; font-weight: 400; line-height: 1.4; color: var(--muted); }
.cq__select { flex: none; }
.cq__select { min-height: 2.75rem; padding: 0.3rem 0.6rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--tile); }
</style>
