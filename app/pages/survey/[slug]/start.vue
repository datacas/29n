<template>
  <div class="start">
    <div v-if="loading" class="wrap stack"><p>{{ $t('common.loading') }}</p></div>
    <div v-else-if="error" class="wrap stack"><p class="note note--alert" role="alert">No se pudo cargar el test. Recarga la página o inténtalo más tarde.</p></div>

    <template v-else-if="releaseData">
      <section class="band on-band">
        <div class="wrap band__inner">
          <NuxtLink :to="`/survey/${releaseId}`" class="back back--band">&larr; {{ $t('common.back') }}</NuxtLink>
          <h1>¿Con qué programa coincides más?</h1>
          <p>Contesta unas preguntas y compara tu opinión con {{ survey.kind === 'historical' ? `${releaseData.entities.length} programas históricos` : `los programas de ${releaseData.entities.length} partidos` }}. Cada porcentaje se apoya en una cita.</p>
        </div>
      </section>

      <div class="wrap stack-lg start__body">
        <StepBar :current="1" :entities="noun.plural" />

        <!-- Modo: varios (compara) o simple (uno solo) -->
        <section class="label" aria-labelledby="h-modo">
          <div class="label__head"><h2 id="h-modo">Modo</h2></div>
          <div class="calibration-options">
            <label v-for="m in selectionModes" :key="m.value" class="choice calibration-option" :class="{ selected: selectionMode === m.value }">
              <input type="radio" name="modo" :value="m.value" v-model="selectionMode" />
              <span class="choice__text">
                <span class="choice__title">{{ m.title }}</span>
                <span class="choice__desc">{{ m.description }}</span>
              </span>
            </label>
          </div>
        </section>

        <!-- Paso 1: partidos -->
        <section class="label" aria-labelledby="h-partidos">
          <div class="label__head">
            <h2 id="h-partidos">{{ single ? `Elige el ${noun.singular} a comparar` : `Elige los ${noun.plural} a comparar` }}</h2>
            <span class="meta" aria-live="polite">{{ single ? `${selectedEntities.length} de 1` : `${selectedEntities.length} de ${releaseData.entities.length}` }}</span>
          </div>
          <div v-if="!single" class="label__body entity-tools">
            <div v-if="hasProvinces" class="province">
              <label for="provincia">Tu provincia</label>
              <select id="provincia" v-model="province" @change="applyProvince">
                <option value="">Elige tu provincia…</option>
                <optgroup v-for="g in provinceGroups" :key="g.comunidad" :label="g.comunidad">
                  <option v-for="c in g.items" :key="c.nombre" :value="c.nombre">{{ c.nombre }}</option>
                </optgroup>
              </select>
            </div>
            <button type="button" class="btn btn--quiet" @click="province = ''; selectedEntities = releaseData.entities.map((e: any) => e.entityId)">Elegir todos</button>
            <button type="button" class="btn btn--quiet" @click="province = ''; selectedEntities = []" :disabled="!selectedEntities.length">Quitar todos</button>
          </div>
          <p v-if="!single && provinceInfo" class="label__foot" role="status">{{ provinceInfo }}</p>
          <div class="entities-selection">
            <label
              v-for="entity in releaseData.entities"
              :key="entity.entityId"
              class="choice entity-option"
              :class="{ selected: selectedEntities.includes(entity.entityId), historical: entity.isHistorical && survey.kind !== 'historical' }"
            >
              <input :type="single ? 'radio' : 'checkbox'" name="entidad" :value="entity.entityId" :checked="selectedEntities.includes(entity.entityId)" @change="pick(entity.entityId)" />
              <span class="choice__name">
                {{ entity.name }}
                <small v-if="entity.periodLabel || (entity.isHistorical && survey.kind !== 'historical')" class="small"> · {{ entity.periodLabel || 'Histórico' }}</small>
              </span>
              <span class="flag flag--mid tnum" :style="{ width: flagWidth(entity.entityId) }" :title="`${positionCount(entity.entityId)} posiciones documentadas`" aria-hidden="true">{{ positionCount(entity.entityId) }}</span>
              <span class="visually-hidden">{{ positionCount(entity.entityId) }} posiciones documentadas</span>
            </label>
          </div>
          <p class="label__foot">La barra mide las posiciones documentadas de cada programa. Los {{ noun.plural }} van en orden alfabético.</p>
        </section>

        <!-- Paso 2: profundidad -->
        <!-- Si las tres profundidades dan las mismas preguntas (encuesta corta), elegir no tiene sentido -->
        <section v-if="depthMatters" aria-labelledby="h-prof" class="stack">
          <h2 id="h-prof">{{ $t('survey.detail.depthTitle') }}</h2>
          <div class="segments depth-options" role="radiogroup" aria-labelledby="h-prof" :style="{ '--n': visibleDepthModes.length }">
            <label v-for="mode in visibleDepthModes" :key="mode.value" class="depth-option" :class="{ selected: depthMode === mode.value }">
              <input type="radio" :value="mode.value" v-model="depthMode" />
              <b>{{ mode.title }}</b>
              <span class="depth-questions tnum">{{ mode.questionCount }} preguntas</span>
            </label>
          </div>
          <p class="small">{{ visibleDepthModes.find((m) => m.value === depthMode)?.description }}<template v-if="depthMode !== 'total'">. Las preguntas regionales salen solo si eliges ese {{ noun.singular }}, y se suman.</template></p>
          <p v-if="selectedEntities.length > 1 && scarceSelection" class="note selection-hint" role="status">
            Estos {{ noun.plural }} solo tienen posiciones documentadas en {{ scarceSelection }} preguntas comunes. Añade más {{ noun.plural }} para un resultado más fiable.
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
        <p v-if="!canStart" class="dock__hint error-hint" role="status">Elige {{ single ? `un ${noun.singular}` : `al menos un ${noun.singular}` }} para empezar.</p>
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
import provinces from '~/data/circunscripciones.json'

const selectedEntities = ref<string[]>([])
const depthMode = ref<'quick' | 'normal' | 'deep' | 'total'>('deep')
const selectionMode = ref<'many' | 'single'>('many')
const single = computed(() => selectionMode.value === 'single')

// Provincia (circunscripción al Congreso): marca de golpe los partidos que se presentan en ella.
// Solo en las encuestas de partidos actuales; se casa por nombre, así que no depende del id de la versión.
const province = ref('')
const hasProvinces = computed(() => survey.value.kind !== 'historical' && (releaseData.value?.entities || []).some((e: any) => provinceEntityNames.has(e.name)))
const provinceEntityNames = new Set<string>((provinces.circunscripciones as any[]).flatMap((c) => c.partidos))
const provinceGroups = computed(() => {
  const m = new Map<string, any[]>()
  for (const c of provinces.circunscripciones as any[]) m.set(c.comunidad, [...(m.get(c.comunidad) ?? []), c])
  return [...m].map(([comunidad, items]) => ({ comunidad, items }))
})
const provinceInfo = ref('')
function applyProvince() {
  const c = (provinces.circunscripciones as any[]).find((x) => x.nombre === province.value)
  if (!c) { provinceInfo.value = ''; return }
  const present = new Set<string>(c.partidos)
  const ids = (releaseData.value?.entities || []).filter((e: any) => present.has(e.name)).map((e: any) => e.entityId)
  selectedEntities.value = ids
  provinceInfo.value = `En ${c.nombre} se presentan ${ids.length} de los ${releaseData.value?.entities.length} ${noun.value.plural} (${provinces.fuente}). Puedes añadir o quitar los que quieras.`
}
watch(province, (v) => { if (!v) provinceInfo.value = '' })
const calibrationMode = ref<'serious' | 'quick' | 'skipped'>('serious')

// Fetch release data
const { data: releaseData, pending: loading, error } = await useFetch(`/data/releases/${releaseId}.json`)

// Ajustes de la encuesta: en la histórica se llaman «programas» y vienen todos elegidos de entrada
const survey = computed<any>(() => (releaseData.value as any)?.consultation ?? {})
const noun = computed<{ singular: string; plural: string }>(() => survey.value.entityNoun ?? { singular: 'partido', plural: 'partidos' })
watch(releaseData, (d: any) => {
  if (d?.consultation?.kind === 'historical' && !selectedEntities.value.length) {
    selectedEntities.value = (d.entities || []).map((e: any) => e.entityId)
  }
}, { immediate: true })

// Calculate question counts per depth mode
const allQuestions = computed(() => releaseData.value?.questions || [])

// Número de preguntas por profundidad: depende de los partidos elegidos (solo salen temas que esos partidos tratan)
const questionsFor = (mode: DepthMode) =>
  selectQuestions(
    allQuestions.value as any[],
    (releaseData.value?.positions || []) as any[],
    (releaseData.value?.entities || []) as any[],
    selectedEntities.value,
    mode,
    undefined,
    survey.value.exhaustive === true
  )

const depthMatters = computed(() => new Set(depthModes.value.map((m) => m.questionCount)).size > 1)
const depthModes = computed(() => {
  const total = questionsFor('total').length
  // «Total» solo se ofrece si añade preguntas a «Profunda»; si no (p. ej. la encuesta histórica, donde la profunda ya
  // incluye todo), «Profunda» pasa a ser la completa.
  const deep = questionsFor('deep').length
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
      description: total === deep
        ? `Todas las preguntas de los ${noun.value.plural} elegidos`
        : `Una selección amplia de todos los temas que tratan los ${noun.value.plural} elegidos`,
      questionCount: deep
    },
    {
      value: 'total' as const,
      title: t('survey.detail.depth.total'),
      description: `Todas las preguntas de los ${noun.value.plural} elegidos, sin dejar ninguna. Las que solo trata uno puntúan solo a ese ${noun.value.singular}`,
      questionCount: total
    }
  ]
})
const totalAddsQuestions = computed(() => {
  const c = Object.fromEntries(depthModes.value.map((m) => [m.value, m.questionCount]))
  return c.total > c.deep
})
const visibleDepthModes = computed(() => depthModes.value.filter((m) => m.value !== 'total' || totalAddsQuestions.value))
// Si «Total» deja de ofrecerse (cambia la selección), vuelve a la profunda: da las mismas preguntas
watch(totalAddsQuestions, (ok) => { if (!ok && depthMode.value === 'total') depthMode.value = 'deep' })

// Varios: se marcan y desmarcan. Simple: solo uno, elegir otro sustituye al anterior
function pick(id: string) {
  if (single.value) selectedEntities.value = [id]
  else selectedEntities.value = selectedEntities.value.includes(id) ? selectedEntities.value.filter((x) => x !== id) : [...selectedEntities.value, id]
}
// Al pasar a simple se parte de cero (salvo que ya hubiera uno solo): no se elige por la persona
watch(selectionMode, (m) => { if (m === 'single') { province.value = ''; if (selectedEntities.value.length !== 1) selectedEntities.value = [] } })

const selectionModes = computed(() => [
  {
    value: 'many' as const,
    title: 'Modo múltiple',
    description: `Comparas tu opinión con varios ${noun.value.plural} a la vez y ves cómo quedan ordenados según tu afinidad. Elige los que quieras.`
  },
  {
    value: 'single' as const,
    title: 'Modo simple',
    description: `Eliges un único ${noun.value.singular} y ves cuánto coincides con él, pregunta a pregunta. No se compara con otros.`
  }
])

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
    case 'total': return 3
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
    // Para que las páginas siguientes llamen igual a las entidades sin volver a descargar la versión
    entityNounPlural: noun.value.plural,
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
.entity-tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--line); }
.province { flex: 1 1 100%; min-width: 0; max-width: 100%; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; }
.province label { font-weight: 500; white-space: nowrap; }
/* Móvil: la etiqueta pasa encima del selector para que este ocupe todo el ancho disponible y no se salga del recuadro */
@media (max-width: 480px) { .province { flex-direction: column; align-items: stretch; gap: var(--space-2); } }
.province select { flex: 1 1 0; min-width: 0; width: 100%; max-width: 100%; text-overflow: ellipsis; min-height: 2.75rem; padding: 0 var(--space-3); border: 1.5px solid var(--ink); border-radius: 10px; background: var(--tile); font-size: 1rem; }
.entity-tools .btn { min-height: 2.5rem; font-size: 1rem; padding: 0.3rem 0.4rem; }
.entities-selection .choice { gap: var(--space-3); }
.entities-selection .flag { flex: none; min-width: 2.4rem; max-width: 46%; }
.entity-option.historical .choice__name { color: var(--ink-soft); }

.depth-options { grid-template-columns: repeat(var(--n, 3), 1fr); }
.depth-option { min-width: 0; }

.dock__hint { margin: var(--space-2) 0 0; text-align: center; }

@media (min-width: 48rem) {
  .entities-selection { display: grid; grid-template-columns: 1fr 1fr; }
  .entities-selection .choice:nth-child(odd) { border-right: 1px solid var(--line); }
  .entities-selection .choice { border-bottom: 1px solid var(--line); }
}
</style>
