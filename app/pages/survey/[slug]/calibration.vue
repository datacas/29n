<template>
  <div class="calibration-serious">
    <section class="band on-band">
      <div class="wrap band__inner">
        <NuxtLink :to="`/survey/${releaseId}/start`" class="back back--band">&larr; {{ $t('common.back') }}</NuxtLink>
        <h1>{{ $t('scoring.calibration.title') }}</h1>
        <p class="description">Elige entre unos pocos pares de temas cuál te importa más. Así el resultado da más peso a lo que tú consideras prioritario.</p>
      </div>
    </section>

    <div class="wrap stack-lg cal__body">
      <StepBar :current="2" :entities="progress?.entityNounPlural" />

      <p v-if="!surveyConfig" class="note note--alert error" role="alert">No se encontró la configuración del test.</p>

      <template v-else>
        <div v-if="currentComparison" class="stack">
          <div class="cal__progress" role="progressbar" :aria-valuenow="comparisonsDone" aria-valuemin="0" :aria-valuemax="totalComparisons" :aria-label="`Comparación ${comparisonsDone + 1} de ${totalComparisons}`">
            <div class="cal__track"><div class="cal__fill progress-fill" :style="{ width: `${progressPercent}%` }"></div></div>
            <span class="progress-text tnum">{{ comparisonsDone }} / {{ totalComparisons }}</span>
          </div>

          <section class="label comparison-card" aria-labelledby="h-cmp">
            <div class="label__head"><h2 id="h-cmp">¿Qué tema te importa más?</h2></div>
            <div class="label__body stack">
              <div class="comparison-options cal__options">
                <button type="button" class="btn-dimension cal__dim" :class="{ selected: selectedSide === 'left' }" :aria-pressed="selectedSide === 'left'" @click="selectedSide = 'left'">
                  {{ getDimName(currentComparison.left) }}
                  <span v-if="getDimHelp(currentComparison.left)" class="cal__hint">{{ getDimHelp(currentComparison.left) }}</span>
                </button>
                <button type="button" class="btn-dimension cal__dim" :class="{ selected: selectedSide === 'right' }" :aria-pressed="selectedSide === 'right'" @click="selectedSide = 'right'">
                  {{ getDimName(currentComparison.right) }}
                  <span v-if="getDimHelp(currentComparison.right)" class="cal__hint">{{ getDimHelp(currentComparison.right) }}</span>
                </button>
              </div>
              <button type="button" class="btn-equal btn btn--block" :class="{ 'is-on': selectedSide === 'equal' }" :aria-pressed="selectedSide === 'equal'" @click="selectedSide = 'equal'">
                Igualmente importantes
              </button>
            </div>
          </section>
        </div>

        <section v-else class="label completed" aria-labelledby="h-done">
          <div class="label__head"><h2 id="h-done">Calibración completada</h2></div>
          <div class="label__body stack">
            <p>Esto es lo que pesa cada tema en tu resultado:</p>
            <ul class="weights-list cal__weights">
              <li v-for="(weight, dimId) in weights" :key="dimId">
                <span class="dim-name">{{ getDimName(dimId) }}</span>
                <span class="flag cal__flag tnum" :style="{ width: `${Math.max(16, Math.round((weight / maxWeight) * 100))}%` }"><span class="weight-value">{{ Math.round(weight * 100) }}%</span></span>
              </li>
            </ul>
          </div>
        </section>
      </template>
    </div>

    <div v-if="surveyConfig" class="dock">
      <div class="dock__inner">
        <template v-if="currentComparison">
          <button type="button" class="btn btn-skip" @click="skipComparison">Omitir</button>
          <button type="button" class="btn-primary cal__next" :disabled="!selectedSide" @click="submitComparison">
            {{ comparisonsDone + 1 === totalComparisons ? 'Finalizar' : 'Siguiente' }}
          </button>
        </template>
        <NuxtLink v-else :to="`/survey/${releaseId}/questions`" class="btn-primary cal__next">Comenzar test</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { dimensionHelp } from '~/lib/survey/dimension-help'
// La barra más larga ocupa todo el ancho y el resto en proporción: con pocos temas, los pesos se acercan al 100 %
const maxWeight = computed(() => Math.max(0.0001, ...Object.values(weights.value).map(Number)))
import {
  computeWeightsFromComparisons,
  type Comparison,
  type ComparisonResult
} from '~/lib/scoring/calibration'

const route = useRoute()
const router = useRouter()
const releaseId = (route.params.slug || route.params.id || '') as string

const { getProgress, saveProgress: persistToDb } = await import('~/lib/storage/indexeddb')
const progress = await getProgress(releaseId)

if (!progress) {
  router.push(`/survey/${releaseId}/start`)
}

// La plantilla comprueba esta variable; antes no existía y la pantalla siempre decía "no se encontró la configuración"
const surveyConfig = progress

const comparisons = ref<Array<{ left: string; right: string; result: ComparisonResult }>>([])
const weights = ref<Record<string, number>>({})
const selectedSide = ref<'left' | 'right' | 'equal' | null>(null)

const dimensions = computed(() => {
  return progress?.dimensions?.map((d: any) => d.dimensionId) || []
})

const dimNames = computed(() => {
  const names: Record<string, string> = {}
  for (const dim of progress?.dimensions || []) {
    names[dim.dimensionId] = dim.name
  }
  return names
})

const dimCodes = computed(() => {
  const codes: Record<string, string> = {}
  for (const dim of progress?.dimensions || []) codes[dim.dimensionId] = dim.code
  return codes
})

function getDimHelp(dimId: string): string {
  return dimensionHelp(dimCodes.value[dimId])
}

function getDimName(dimId: string): string {
  return dimNames.value[dimId] || dimId
}

// Pocas comparaciones, bien repartidas: los temas se colocan en un anillo (orden aleatorio por sesión)
// y se comparan los vecinos y los opuestos. Con 6 temas son 9 comparaciones y cada tema sale 3 veces.
function planPairs(ids: string[]): Array<[string, string]> {
  const order = [...ids].sort(() => Math.random() - 0.5)
  const n = order.length
  const seen = new Set<string>()
  const pairs: Array<[string, string]> = []
  const add = (i: number, j: number) => {
    const a = order[i % n], b = order[j % n]
    const key = [a, b].sort().join(':')
    if (a === b || seen.has(key)) return
    seen.add(key)
    pairs.push(Math.random() < 0.5 ? [a, b] : [b, a])
  }
  for (let i = 0; i < n; i++) add(i, i + 1)                         // vecinos
  if (n >= 4) for (let i = 0; i < Math.floor(n / 2); i++) add(i, i + Math.floor(n / 2)) // opuestos
  return pairs
}
const plannedPairs = planPairs(dimensions.value)
const totalComparisons = computed(() => plannedPairs.length)


// Ningún tema puede quedarse en 0 %: aunque pierda todas sus comparaciones, conserva al menos un 5 % del peso
const MIN_WEIGHT = 0.05
function withFloor(w: Record<string, number>): Record<string, number> {
  const ids = Object.keys(w)
  if (ids.length === 0 || MIN_WEIGHT * ids.length >= 1) return w
  let out: Record<string, number> = { ...w }
  for (let i = 0; i < 10; i++) {                       // sube los que no llegan y reparte la diferencia entre el resto
    const low = ids.filter((k) => out[k] < MIN_WEIGHT)
    if (low.length === 0) break
    const fixed = low.length * MIN_WEIGHT
    const free = ids.filter((k) => !low.includes(k))
    const freeSum = free.reduce((a, k) => a + out[k], 0) || 1
    const next: Record<string, number> = {}
    for (const k of low) next[k] = MIN_WEIGHT
    for (const k of free) next[k] = out[k] * ((1 - fixed) / freeSum)
    out = next
  }
  const total = ids.reduce((a, k) => a + out[k], 0)
  for (const k of ids) out[k] = Math.round((out[k] / total) * 10000) / 10000
  return out
}

const comparisonsDone = computed(() => comparisons.value.length)
const progressPercent = computed(() => {
  if (totalComparisons.value === 0) return 100
  return (comparisonsDone.value / totalComparisons.value) * 100
})

const currentComparison = computed<Comparison | null>(() => {
  const next = plannedPairs[comparisons.value.length]
  return next ? ({ left: next[0], right: next[1] } as Comparison) : null
})

function submitComparison() {
  if (!currentComparison.value || !selectedSide.value) return
  
  const result: ComparisonResult = selectedSide.value === 'equal' ? 'equal' : selectedSide.value
  
  comparisons.value.push({
    left: currentComparison.value.left,
    right: currentComparison.value.right,
    result
  })
  
  selectedSide.value = null
  
  // If all comparisons done, compute weights
  if (comparisonsDone.value + 1 >= totalComparisons.value) {
    weights.value = withFloor(computeWeightsFromComparisons(dimensions.value, comparisons.value))
    if (progress) {
      progress.calibrationWeights = weights.value
      progress.calibrationMode = 'serious'
      persistToDb(progress)
    }
  }
}

function skipComparison() {
  if (!currentComparison.value) return
  
  comparisons.value.push({
    left: currentComparison.value.left,
    right: currentComparison.value.right,
    result: 'skip'
  })
  
  selectedSide.value = null
  
  if (comparisonsDone.value + 1 >= totalComparisons.value) {
    weights.value = withFloor(computeWeightsFromComparisons(dimensions.value, comparisons.value))
    if (progress) {
      progress.calibrationWeights = weights.value
      progress.calibrationMode = 'serious'
      persistToDb(progress)
    }
  }
}
</script>

<style scoped>
.cal__body { padding-top: var(--space-5); padding-bottom: var(--space-6); }
.back--band { color: var(--muted); margin-bottom: var(--space-2); }
.cal__progress { display: flex; align-items: center; gap: var(--space-3); }
.cal__track { flex: 1; height: 0.4rem; border-radius: 99px; overflow: hidden; background: var(--line); }
.cal__fill { height: 100%; background: var(--band); transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.progress-text { font-size: 0.9rem; font-weight: 500; color: var(--muted); }
.cal__options { display: grid; gap: var(--space-3); }
.cal__dim { min-height: 5rem; padding: var(--space-3) var(--space-4); border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--tile); font-size: 1.6rem; font-weight: 450; letter-spacing: -0.03em; line-height: 1.1; text-align: left; transition: background-color 0.15s var(--ease); }
.cal__hint { display: block; margin-top: 0.5rem; font-size: 0.85rem; font-weight: 400; letter-spacing: 0; line-height: 1.4; color: var(--muted); }
.cal__dim.selected .cal__hint { color: rgba(255, 255, 255, 0.85); }
.cal__dim:hover { background: var(--tint); }
.cal__dim.selected { background: var(--ink); color: #fff; }
.btn-equal.is-on { background: var(--ink); color: #fff; }
.cal__weights { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
.cal__weights li { display: grid; gap: 0.25rem; }
.dim-name { font-weight: 700; }
.cal__flag { height: 1.9rem; justify-content: flex-start; max-width: 100%; box-sizing: border-box; }
.cal__next { flex: 1; text-decoration: none; }
.dock .btn-skip { flex: none; }
@media (min-width: 40rem) { .cal__options { grid-template-columns: 1fr 1fr; } }
</style>
