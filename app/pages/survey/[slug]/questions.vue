<template>
  <div class="survey-questions">
    <div v-if="loading" class="wrap"><p class="loading q__pad">Cargando...</p></div>
    <div v-else-if="!progress" class="wrap q__pad">
      <p class="note note--alert error" role="alert">No se encontró la configuración de la encuesta. <NuxtLink :to="`/survey/${releaseId}/start`">Volver</NuxtLink></p>
    </div>

    <template v-else>
      <div class="wrap q__top">
        <StepBar :current="3" />
        <div class="q__progress progress-bar" role="progressbar" :aria-valuenow="currentQuestionIndex + 1" aria-valuemin="1" :aria-valuemax="questions.length" :aria-label="`Pregunta ${currentQuestionIndex + 1} de ${questions.length}`">
          <div class="q__track"><div class="q__fill progress-fill" :style="{ width: `${progressPercent}%` }"></div></div>
          <span class="progress-text tnum">{{ currentQuestionIndex + 1 }} / {{ questions.length }}</span>
        </div>
      </div>

      <div class="wrap q__body stack-lg" v-if="currentQuestion">
        <section class="label question-card" :aria-labelledby="'q-' + currentQuestion.questionId">
          <div class="label__head question-meta">
            <h2 class="dimension-tag">{{ currentQuestion.dimensionName }}</h2>
            <span v-if="currentQuestion.topicName" class="meta topic-tag">{{ currentQuestion.topicName }}</span>
          </div>
          <div class="label__body stack">
            <h2 class="question-text" :id="'q-' + currentQuestion.questionId">{{ currentQuestion.canonicalText }}</h2>

            <!-- Contexto: cerrado por defecto, siempre visible como botón -->
            <details v-if="currentQuestion.contextText" :key="currentQuestion.questionId" class="question-context">
              <summary><span class="q__ctx-title">¿Qué significa esto?</span><span class="ctx-hint">Toca para ver una explicación</span></summary>
              <p>{{ currentQuestion.contextText }}</p>
            </details>

            <fieldset v-if="currentQuestion.answerType === 'scale'" class="answer-options q__fieldset">
              <legend class="visually-hidden">Tu respuesta</legend>
              <label
                v-for="opt in scaleOptions"
                :key="opt.value"
                class="answer-option"
                :class="{ selected: answers[currentQuestion.questionId] === opt.value }"
              >
                <input type="radio" :value="opt.value" v-model="answers[currentQuestion.questionId]" @change="haptic()" />
                <span class="option-label">
                  <span class="option-value tnum">{{ opt.value > 0 ? '+' + opt.value : opt.value }}</span>
                  <span class="option-text">{{ opt.label }}</span>
                </span>
              </label>
            </fieldset>
            <p class="small q__hint">Si no tienes opinión, marca «No sé». Esa pregunta no cuenta en tu resultado.</p>
          </div>

          <!-- Importancia: opcional -->
          <div class="label__foot importance-section">
            <label class="importance-label" for="importance-select">
              ¿Te importa especialmente este tema? <span class="importance-optional">(opcional)</span>
            </label>
            <span class="info-tip" tabindex="0" role="note" aria-label="Qué hace esta opción">?
              <span class="info-tip-text">No hace falta que elijas nada. Déjalo en «Media» si no quieres dar más o menos peso a esta pregunta. Elige «Alta» si es un tema clave para ti (cuenta el doble en tu resultado) o «Baja» si te importa poco (cuenta la mitad).</span>
            </span>
            <select id="importance-select" v-model="questionImportance[currentQuestion.questionId]" class="importance-select">
              <option value="low">{{ $t('survey.take.importance.low') }}</option>
              <option value="medium">{{ $t('survey.take.importance.medium') }}</option>
              <option value="high">{{ $t('survey.take.importance.high') }}</option>
            </select>
          </div>
        </section>

        <button type="button" class="btn btn--quiet btn-skip" @click="skipQuestion">{{ $t('survey.take.skip') }} esta pregunta</button>

        <details class="question-list">
          <summary>Ver todas las preguntas</summary>
          <ol class="questions-nav">
            <li
              v-for="(q, idx) in questions"
              :key="q.questionId"
              class="nav-item"
              :class="{ current: idx === currentQuestionIndex, answered: isAnswered(q.questionId), skipped: isSkipped(q.questionId) }"
            >
              <button type="button" class="nav-btn" @click="currentQuestionIndex = idx">
                <span class="nav-number tnum">{{ idx + 1 }}</span>
                <span class="nav-text">{{ q.canonicalText.substring(0, 80) }}{{ q.canonicalText.length > 80 ? '...' : '' }}</span>
                <span class="nav-state small">{{ isAnswered(q.questionId) ? 'Contestada' : isSkipped(q.questionId) ? 'Omitida' : '' }}</span>
              </button>
            </li>
          </ol>
        </details>
      </div>

      <div class="dock navigation">
        <div class="dock__inner">
          <button type="button" class="btn btn-secondary" :disabled="currentQuestionIndex === 0" @click="prevQuestion">&larr; Anterior</button>
          <button v-if="currentQuestionIndex < questions.length - 1" type="button" class="btn-primary q__next" @click="nextQuestion">Siguiente &rarr;</button>
          <button v-else type="button" class="btn-primary btn-finish q__next" @click="finishSurvey">{{ $t('survey.take.finish') }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const haptic = useHaptic()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const releaseId = (route.params.slug || route.params.id || '') as string

// Load survey progress from IndexedDB (client-side only)
const { getProgress, saveProgress: persistToDb } = await import('~/lib/storage/indexeddb')

const loading = ref(true)
const progress = ref<any>(null)
const currentQuestionIndex = ref(0)
const answers = ref<Record<string, number>>({})
const skippedQuestions = ref<Set<string>>(new Set())
const questionImportance = ref<Record<string, 'low' | 'medium' | 'high'>>({})

if (import.meta.client) {
  const loaded = await getProgress(releaseId)
  if (!loaded) {
    // No progress found, redirect to start
    router.push(`/survey/${releaseId}/start`)
  } else {
    progress.value = loaded
    currentQuestionIndex.value = loaded.currentQuestionIndex || 0
    answers.value = loaded.answers || {}
    skippedQuestions.value = new Set(loaded.skippedQuestions || [])
    questionImportance.value = loaded.questionImportance || {}
    // Initialize default importance for any missing questions
    for (const q of loaded.questions || []) {
      if (!(q.questionId in questionImportance.value)) {
        questionImportance.value[q.questionId] = 'medium'
      }
    }
  }
  loading.value = false
}

const questions = computed(() => progress.value?.questions || [])
const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] || null)

const progressPercent = computed(() => {
  if (questions.value.length === 0) return 0
  return ((currentQuestionIndex.value + 1) / questions.value.length) * 100
})

import { buildAnswerArray } from '~/lib/survey/answers'

const scaleOptions = [
  { value: -2, label: t('survey.take.scale.strongly_disagree') },
  { value: -1, label: t('survey.take.scale.disagree') },
  { value: 0, label: t('survey.take.scale.neutral') },
  { value: 1, label: t('survey.take.scale.agree') },
  { value: 2, label: t('survey.take.scale.strongly_agree') }
]

function isAnswered(questionId: string): boolean {
  return answers.value[questionId] !== undefined && answers.value[questionId] !== null
}

function isSkipped(questionId: string): boolean {
  return skippedQuestions.value.has(questionId)
}

function skipQuestion() {
  if (currentQuestion.value) {
    skippedQuestions.value.add(currentQuestion.value.questionId)
    delete answers.value[currentQuestion.value.questionId]
    nextQuestion()
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
    persistProgress()
  }
}

function prevQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

function persistProgress() {
  // Auto-save to IndexedDB (persists across browser restarts)
  if (!progress.value) return
  progress.value.answers = { ...answers.value }
  progress.value.skippedQuestions = Array.from(skippedQuestions.value)
  progress.value.questionImportance = { ...questionImportance.value }
  progress.value.currentQuestionIndex = currentQuestionIndex.value
  progress.value.updatedAt = new Date().toISOString()
  persistToDb(progress.value)
}

// Auto-save on answer change
watch(answers, () => persistProgress(), { deep: true })
watch(questionImportance, () => persistProgress(), { deep: true })

function finishSurvey() {
  if (!progress.value) return
  
  // Build answers array for scoring engine
  // «No sé / Sin opinión», sin tocar y omitidas no cuentan en el resultado
  const answerArray = buildAnswerArray(questions.value, answers.value, skippedQuestions.value)
  
  // Build weights array
  const weightsArray = questions.value.map(q => ({
    questionId: q.questionId,
    importance: questionImportance.value[q.questionId] || 'medium'
  }))
  
  // Store completed data in IndexedDB for results page
  progress.value.answers = answerArray
  progress.value.weights = weightsArray
  progress.value.completedAt = new Date().toISOString()
  persistToDb(progress.value)
  
  // Navigate to results (calculated client-side)
  router.push(`/survey/${releaseId}/results`)
}
</script>

<style scoped>
.q__pad { padding: var(--space-6) 0; }
.q__top { padding-top: var(--space-4); display: grid; gap: var(--space-3); }
.q__progress { display: flex; align-items: center; gap: var(--space-3); }
.q__track { flex: 1; height: 0.4rem; border-radius: 99px; overflow: hidden; background: var(--line); }
.q__fill { height: 100%; background: var(--band); transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.progress-text { font-size: 0.9rem; font-weight: 500; color: var(--muted); white-space: nowrap; }
.q__body { padding-top: var(--space-4); padding-bottom: var(--space-6); }
.question-meta h2 { font-size: 0.78rem; }
.question-text { font-size: clamp(1.55rem, 6vw, 2.1rem); line-height: 1.12; letter-spacing: -0.03em; font-weight: 450; }

.question-context { border-radius: 14px; background: var(--tint); }
.question-context summary { display: grid; gap: 2px; padding: var(--space-3) var(--space-4); cursor: pointer; list-style: none; min-height: 3rem; }
.question-context summary::-webkit-details-marker { display: none; }
.q__ctx-title { font-size: 1.05rem; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
.q__ctx-title::after { content: ""; display: inline-block; width: 0.5rem; height: 0.5rem; margin-left: 0.6rem; border-right: 3px solid currentColor; border-bottom: 3px solid currentColor; transform: translateY(-3px) rotate(45deg); transition: transform 0.2s; }
.question-context[open] .q__ctx-title::after { transform: translateY(0) rotate(-135deg); }
.ctx-hint { font-size: var(--step--1); color: var(--ink-soft); }
.question-context p { padding: 0 var(--space-4) var(--space-4); max-width: none; line-height: 1.5; }

.q__hint { max-width: none; }
.q__fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: var(--space-2); min-width: 0; }
.answer-option { display: block; cursor: pointer; }
.answer-option input { position: absolute; opacity: 0; pointer-events: none; }
.option-label { display: flex; align-items: center; gap: var(--space-3); min-height: 3.5rem; padding: 0.5rem var(--space-3); border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--tile); transition: background-color 0.15s var(--ease); }
.answer-option:hover .option-label { background: var(--tint); border-color: var(--ink); }
.option-value { flex: none; min-width: 2.5rem; text-align: center; font-size: 1.1rem; font-weight: 600; padding: 0.25rem 0; border-radius: 8px; background: var(--tint); }
.option-text { font-weight: 500; line-height: 1.25; }
.answer-option.selected .option-label { background: var(--ink); border-color: var(--ink); color: #fff; }
.answer-option.selected .option-value { background: #fff; color: var(--ink); }
.answer-option:has(input:focus-visible) .option-label { outline: 3px solid var(--focus); outline-offset: 2px; }

.importance-section { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
.importance-label { font-weight: 700; flex: 1 1 14rem; }
.importance-optional { font-weight: 400; color: var(--ink-soft); }
.importance-select { min-height: 2.75rem; padding: 0.3rem 0.6rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper); }
.info-tip { position: relative; display: inline-grid; place-content: center; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--ink); color: #fff; font: 700 0.9rem/1 var(--font-body); cursor: help; }
.info-tip-text { display: none; position: absolute; left: 50%; bottom: 140%; transform: translateX(-30%); width: min(20rem, 80vw); padding: var(--space-3); background: var(--ink); color: #fff; border-radius: var(--radius); font-weight: 400; line-height: 1.4; font-size: var(--step--1); z-index: 8; text-align: left; }
.info-tip:hover .info-tip-text, .info-tip:focus .info-tip-text, .info-tip:focus-within .info-tip-text { display: block; }
.btn-skip { align-self: flex-start; }

.q__next { flex: 1; }
.dock .btn-secondary { flex: none; }
.question-list { border: 1px solid var(--line); border-radius: var(--radius); }
.question-list summary { padding: var(--space-3) var(--space-4); cursor: pointer; font-weight: 700; min-height: 3rem; }
.questions-nav { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.nav-item { border-bottom: 1px solid var(--line); }
.nav-item:last-child { border-bottom: 0; }
.nav-btn { width: 100%; display: grid; grid-template-columns: 2rem 1fr auto; gap: var(--space-3); align-items: center; text-align: left; background: transparent; border: 0; padding: var(--space-3) var(--space-4); min-height: 3rem; }
.nav-btn:hover { background: var(--tint); }
.nav-number { font-weight: 600; }
.nav-item.current .nav-btn { background: var(--tint); font-weight: 700; }
.nav-item.skipped .nav-text { color: var(--ink-soft); text-decoration: line-through; }
@media (min-width: 48rem) { .q__fieldset { grid-template-columns: 1fr; } }
</style>
