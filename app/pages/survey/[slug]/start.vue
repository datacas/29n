<template>
  <div class="start">
    <div v-if="loading" class="wrap stack"><p>{{ $t('common.loading') }}</p></div>
    <div v-else-if="error" class="wrap stack"><p class="note note--alert" role="alert">No se pudo cargar la encuesta. Recarga la página o inténtalo más tarde.</p></div>

    <template v-else-if="releaseData">
      <section class="band on-band">
        <div class="wrap band__inner">
          <NuxtLink :to="`/survey/${releaseId}`" class="back back--band">&larr; {{ $t('common.back') }}</NuxtLink>
          <h1>¿Con qué programa coincides más?</h1>
          <p>Contesta unas preguntas y compara tu opinión con los programas de {{ releaseData.entities.length }} partidos. Cada porcentaje se apoya en una cita.</p>
        </div>
      </section>

      <div class="wrap stack-lg start__body">
        <StepBar :current="1" />

        <!-- Paso 1: partidos -->
        <section class="label" aria-labelledby="h-partidos">
          <div class="label__head">
            <h2 id="h-partidos">Elige los partidos a comparar</h2>
            <span class="meta" aria-live="polite">{{ selectedEntities.length }} de {{ releaseData.entities.length }}</span>
          </div>
          <div class="label__body entity-tools">
            <button type="button" class="btn btn--quiet" @click="selectedEntities = releaseData.entities.map((e: any) => e.entityId)">Elegir todos</button>
            <button type="button" class="btn btn--quiet" @click="selectedEntities = []" :disabled="!selectedEntities.length">Quitar todos</button>
          </div>
          <div class="entities-selection">
            <label
              v-for="entity in releaseData.entities"
              :key="entity.entityId"
              class="choice entity-option"
              :class="{ selected: selectedEntities.includes(entity.entityId), historical: entity.isHistorical }"
            >
              <input type="checkbox" :value="entity.entityId" v-model="selectedEntities" />
              <span class="choice__name">
                {{ entity.name }}
                <small v-if="entity.isHistorical" class="small"> · {{ entity.periodLabel || 'Histórico' }}</small>
              </span>
              <span class="flag flag--mid tnum" :style="{ width: flagWidth(entity.entityId) }" :title="`${positionCount(entity.entityId)} posiciones documentadas`" aria-hidden="true">{{ positionCount(entity.entityId) }}</span>
              <span class="visually-hidden">{{ positionCount(entity.entityId) }} posiciones documentadas</span>
            </label>
          </div>
          <p class="label__foot">La barra mide las posiciones documentadas de cada programa. Los partidos van en orden alfabético.</p>
        </section>

        <!-- Paso 2: profundidad -->
        <section aria-labelledby="h-prof" class="stack">
          <h2 id="h-prof">{{ $t('survey.detail.depthTitle') }}</h2>
          <div class="segments depth-options" role="radiogroup" aria-labelledby="h-prof">
            <label v-for="mode in depthModes" :key="mode.value" class="depth-option" :class="{ selected: depthMode === mode.value }">
              <input type="radio" :value="mode.value" v-model="depthMode" />
              <b>{{ mode.title }}</b>
              <span class="depth-questions tnum">{{ mode.questionCount }} preguntas</span>
            </label>
          </div>
          <p class="small">{{ depthModes.find((m) => m.value === depthMode)?.description }}. Las preguntas regionales salen solo si eliges ese partido, y se suman.</p>
          <p v-if="selectedEntities.length > 1 && scarceSelection" class="note selection-hint" role="status">
            Estos partidos solo tienen posiciones documentadas en {{ scarceSelection }} preguntas comunes. Añade más partidos para un resultado más fiable.
          </p>
        </section>

        <!-- Paso 3: prioridades -->
        <section class="label" aria-labelledby="h-prio">
          <div class="label__head"><h2 id="h-prio">{{ $t('scoring.calibration.title') }}</h2></div>
          <div class="calibration-options">
            <label v-for="mode in calibrationModes" :key="mode.value" class="choice calibration-option" :class="{ selected: calibrationMode === mode.value }">
              <input type="radio" :value="mode.value" v-model="calibrationMode" />
              <span class="choice__text">
                <span class="choice__title">{{ mode.title }}</span>
                <span class="choice__desc">{{ mode.description }}</span>
              </span>
            </label>
          </div>
        </section>

        <p class="privacy-note small">Solo contamos usos de forma anónima (sin tus respuestas ni datos personales). <NuxtLink to="/metodologia">Cómo funciona</NuxtLink></p>
      </div>

      <div class="dock actions">
        <div class="dock__inner">
          <button class="btn-primary btn--block" :disabled="!canStart" @click="startSurvey">
            <span>Comenzar<template v-if="canStart"> · <span class="tnum">{{ filteredQuestions.length }}</span> preguntas</template></span>
          </button>
        </div>
        <p v-if="!canStart" class="dock__hint error-hint" role="status">Elige al menos un partido para empezar.</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const releaseId = (route.params.slug || route.params.id || '') as string
import { selectQuestions, type DepthMode } from '~/lib/survey/select-questions'

const selectedEntities = ref<string[]>([])
const depthMode = ref<'quick' | 'normal' | 'deep'>('normal')
const calibrationMode = ref<'serious' | 'quick' | 'skipped'>('serious')

// Fetch release data
const { data: releaseData, pending: loading, error } = await useFetch(`/data/releases/${releaseId}.json`)

// Calculate question counts per depth mode
const allQuestions = computed(() => releaseData.value?.questions || [])

// Número de preguntas por profundidad: depende de los partidos elegidos (solo salen temas que esos partidos tratan)
const questionsFor = (mode: DepthMode) =>
  selectQuestions(
    allQuestions.value as any[],
    (releaseData.value?.positions || []) as any[],
    (releaseData.value?.entities || []) as any[],
    selectedEntities.value,
    mode
  )

const depthModes = computed(() => {
  return [
    {
      value: 'quick' as const,
      title: t('survey.detail.depth.quick'),
      description: 'Las preguntas más esenciales de cada área',
      questionCount: questionsFor('quick').length
    },
    {
      value: 'normal' as const,
      title: t('survey.detail.depth.normal'),
      description: 'Equilibrio entre profundidad y tiempo',
      questionCount: questionsFor('normal').length
    },
    {
      value: 'deep' as const,
      title: t('survey.detail.depth.deep'),
      description: 'Todos los temas que tratan los partidos elegidos',
      questionCount: questionsFor('deep').length
    }
  ]
})

const calibrationModes = computed(() => [
  {
    value: 'serious' as const,
    title: t('scoring.calibration.serious'),
    description: t('scoring.calibration.seriousDescription')
  },
  {
    value: 'quick' as const,
    title: t('scoring.calibration.quick'),
    description: t('scoring.calibration.quickDescription')
  },
  {
    value: 'skipped' as const,
    title: t('scoring.calibration.skip'),
    description: t('scoring.calibration.skipDescription')
  }
])

// Posiciones documentadas por partido (para la barra de cada fila)
const positionsByEntity = computed(() => {
  const m = new Map<string, number>()
  for (const p of (releaseData.value?.positions || []) as any[]) {
    if (p.value === null || p.value === undefined) continue
    m.set(p.entityId, (m.get(p.entityId) ?? 0) + 1)
  }
  return m
})
const positionCount = (id: string) => positionsByEntity.value.get(id) ?? 0
const maxPositions = computed(() => Math.max(1, ...positionsByEntity.value.values()))
const flagWidth = (id: string) => `${Math.max(14, Math.round((positionCount(id) / maxPositions.value) * 46))}%`

const canStart = computed(() => selectedEntities.value.length > 0)

// Si dos partidos apenas comparten preguntas, conviene avisar: el resultado sería muy frágil.
const scarceSelection = computed(() => {
  if (selectedEntities.value.length < 2) return 0
  const n = questionsFor('normal').length
  return n > 0 && n < 5 ? n : 0
})

// Get filtered questions based on depth mode
const filteredQuestions = computed(() => questionsFor(depthMode.value))

function depthModeToLevel(mode: string): number {
  switch (mode) {
    case 'quick': return 1
    case 'normal': return 2
    case 'deep': return 3
    default: return 2
  }
}

async function startSurvey() {
  if (!canStart.value) return
  
  // Store survey progress in IndexedDB (persists across browser restarts)
  const { saveProgress } = await import('~/lib/storage/indexeddb')
  const progress = {
    release_id: releaseId,
    local_id: crypto.randomUUID(),
    selectedEntities: selectedEntities.value,
    depthMode: depthMode.value,
    calibrationMode: calibrationMode.value,
    questions: filteredQuestions.value,
    entities: releaseData.value!.entities.filter((e: any) => 
      selectedEntities.value.includes(e.entityId)
    ),
    positions: releaseData.value!.positions,
    dimensions: releaseData.value!.dimensions,
    answers: {} as Record<string, number>,
    skippedQuestions: [] as string[],
    questionImportance: {} as Record<string, 'low' | 'medium' | 'high'>,
    currentQuestionIndex: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  // Initialize default importance for all questions
  for (const q of filteredQuestions.value) {
    progress.questionImportance[q.questionId] = 'medium'
  }
  
  await saveProgress(progress)
  track('survey_started', releaseId, {
    mode: depthMode.value,
    questionCount: filteredQuestions.value.length,
    partiesCount: selectedEntities.value.length,
    parties: progress.entities.map((e: any) => e.name)
  })
  
  // Redirect to calibration or questions
  if (calibrationMode.value === 'serious') {
    router.push(`/survey/${releaseId}/calibration`)
  } else if (calibrationMode.value === 'quick') {
    router.push(`/survey/${releaseId}/calibration-quick`)
  } else {
    router.push(`/survey/${releaseId}/questions`)
  }
}
</script>

<style scoped>
.start__body { padding-top: var(--space-5); padding-bottom: var(--space-6); }
.back--band { color: var(--muted); margin-bottom: var(--space-3); }
.entity-tools { display: flex; gap: var(--space-3); padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--line); }
.entity-tools .btn { min-height: 2.5rem; font-size: 1rem; padding: 0.3rem 0.4rem; }
.entities-selection .choice { gap: var(--space-3); }
.entities-selection .flag { flex: none; min-width: 2.4rem; max-width: 46%; }
.entity-option.historical .choice__name { color: var(--ink-soft); }

.dock__hint { margin: var(--space-2) 0 0; text-align: center; }

@media (min-width: 48rem) {
  .entities-selection { display: grid; grid-template-columns: 1fr 1fr; }
  .entities-selection .choice:nth-child(odd) { border-right: 1px solid var(--line); }
  .entities-selection .choice { border-bottom: 1px solid var(--line); }
}
</style>
