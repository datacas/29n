<template>
  <div class="survey-results">
    <div v-if="loading" class="wrap"><p class="loading r__pad">Cargando...</p></div>
    <div v-else-if="!progress" class="wrap r__pad">
      <p class="note note--alert error" role="alert">No se encontró el progreso de la encuesta. <NuxtLink :to="`/survey/${releaseId}/start`">Comenzar de nuevo</NuxtLink></p>
    </div>

    <template v-else>
      <section class="band on-band">
        <div class="wrap band__inner">
          <h1>{{ $t('survey.results.title') }}</h1>
          <p class="survey-title">Cada barra mide cuánto coincide tu opinión con {{ isHistoricalSurvey ? 'cada programa' : 'el programa de cada partido' }}.</p>
          <p v-if="isHistoricalSurvey" class="note r__hist"><strong>Son textos de hace casi un siglo.</strong> Coincidir con una propuesta concreta no equivale a compartir ese régimen ni sus crímenes. Lee la ficha de cada programa para saber qué pasó después.</p>
        </div>
      </section>

      <div class="wrap stack-lg r__body">
        <StepBar :current="4" :entities="noun.plural" />

        <section class="how-to-read stack" aria-labelledby="h-leer">
          <h2 id="h-leer" class="visually-hidden">Cómo leer estos resultados</h2>
          <p v-if="!isHistoricalSurvey" class="note r__alert"><strong>Ojo con contestar «de acuerdo» a todo:</strong> te acerca a los {{ noun.plural }} que prometen más intervención pública. Responde con tu opinión.</p>
          <details class="r__how">
            <summary>Cómo leer estos resultados</summary>
            <ul>
              <li v-if="!isHistoricalSurvey"><strong>Sobre contestar «de acuerdo» a todo.</strong> Los programas hablan sobre todo de lo que quieren hacer o gastar. Si apoyas casi todas las propuestas, saldrás más cerca de los {{ noun.plural }} que prometen más intervención pública. Responde con tu opinión y usa «en desacuerdo» cuando lo estés.</li>
              <li><strong>El porcentaje</strong> mide cuánto coincide tu opinión con lo que dice {{ isHistoricalSurvey ? 'cada programa' : 'el programa de cada partido' }}: 100 % es coincidir del todo y 0 % estar en polos opuestos.</li>
              <li><strong>Solo cuentan las preguntas en las que el programa dice algo.</strong> Si un {{ noun.singular }} no se pronuncia sobre un tema, ese tema no suma ni resta. Tampoco cuentan las que contestaste «No sé» o omitiste.</li>
              <li><strong>«Tiene posición en X de tus Y preguntas»</strong> te dice en cuántas de las que contestaste hay datos. Con pocos datos, el porcentaje es menos fiable.</li>
              <li><strong>Los {{ noun.plural }} con pocos datos</strong> aparecen al final aunque su porcentaje sea alto: con menos de {{ minEval }} preguntas documentadas el resultado es solo orientativo.</li>
              <li><strong>«Por qué este porcentaje»</strong> te enseña cada pregunta, tu respuesta, la posición del {{ noun.singular }} y la cita literal del programa, con su página.</li>
              <li>Más detalle de cómo se calcula y de dónde salen los datos en <NuxtLink to="/metodologia">Cómo funciona</NuxtLink>.</li>
            </ul>
          </details>
          <p v-if="priorityList.length" class="priorities small">
            <strong>Tus prioridades:</strong>
            <span v-for="(pr, i) in priorityList" :key="pr.name">{{ i ? ' · ' : ' ' }}{{ pr.name }} {{ pr.percent }} %</span>
          </p>
        </section>

        <p v-if="coverageWarning" class="note note--alert coverage-warning" role="status">
          <strong>{{ $t('survey.results.lowCoverage') }}.</strong> {{ coverageWarning }}
        </p>

        <div v-if="results.length === 0" class="no-results"><p>{{ $t('survey.results.noData') }}</p></div>

        <ol v-else class="results-list">
          <li v-for="result in sortedResults" :key="result.entityId" class="result-card label" :class="{ historical: result.historical && !isHistoricalSurvey, 'is-low': low(result) }">
            <div class="label__head entity-header">
              <h2 class="entity-name">
                {{ getEntityName(result.entityId) }}
                <span v-if="result.historical && !isHistoricalSurvey" class="historical-badge small">Histórico</span>
              </h2>
              <span v-if="low(result)" class="low-data-badge" :title="`Este ${noun.singular} tiene pocas posiciones documentadas en las preguntas que contestaste: el resultado es solo orientativo.`">Pocos datos</span>
            </div>
            <div class="label__body stack">
              <p v-if="isHistoricalSurvey && entityInfo(result.entityId)?.description" class="r__ficha small">
                <strong>{{ entityInfo(result.entityId)?.periodLabel }}.</strong> {{ entityInfo(result.entityId)?.description }}
              </p>
              <div class="affinity-score r__score">
                <span v-if="result.affinityPercent !== null" class="flag r__flag tnum" :class="low(result) ? 'flag--ghost' : ''" :style="{ width: `${Math.max(16, result.affinityPercent)}%` }">
                  <span class="score-value">{{ result.affinityPercent }}%</span>
                </span>
                <span v-else class="no-data">{{ $t('survey.results.noData') }}</span>
              </div>

              <dl class="r__stats coverage-info" :aria-label="`Resumen de ${getEntityName(result.entityId)}`">
                <div><dt>Posiciones del programa</dt><dd class="tnum">{{ summary(result.entityId).documented }}</dd></div>
                <div><dt>Entran en tu encuesta</dt><dd class="tnum">{{ summary(result.entityId).entered }}</dd></div>
                <div class="r__stat--ok"><dt>Coincidís</dt><dd class="tnum">{{ summary(result.entityId).coincide }}</dd></div>
                <div class="r__stat--no"><dt>No coincidís</dt><dd class="tnum">{{ summary(result.entityId).discrepan }}</dd></div>
              </dl>
              <p class="small coverage-label">
                De las <strong class="tnum">{{ result.answeredQuestions }}</strong> preguntas que contestaste, el programa tiene posición en <strong class="tnum">{{ result.evaluableQuestions }}</strong>. «Coincidís» es que tu respuesta y el programa estén a un punto o menos en la escala.
              </p>

              <details class="evidence-section r__det">
                <summary>Ver el detalle por tema: tu respuesta frente al programa</summary>
                <details v-for="sec in sections(result.entityId)" :key="sec.dimensionId" class="r__sec">
                  <summary class="r__sechead">
                    <h3>{{ sec.name }}</h3>
                    <p class="small tnum">
                      {{ sec.entered }} de {{ sec.documented }} posiciones del programa entran en tu encuesta
                      <template v-if="sec.entered"> · {{ sec.coincide }} coinciden y {{ sec.discrepan }} no</template>
                      <template v-if="sec.percent !== null"> · afinidad {{ sec.percent }} %</template>
                    </p>
                  </summary>
                  <ul class="r__rows">
                    <li v-for="row in sec.rows" :key="row.questionId" class="r__row evidence-item">
                      <p class="r__q evidence-question">{{ row.text }}</p>
                      <div class="r__vs">
                        <span class="r__cell"><small>Tú</small><b>{{ stanceLabel(row.user) }}</b></span>
                        <span class="r__cell"><small>El programa</small><b>{{ stanceLabel(row.party) }}</b></span>
                        <span class="r__cell r__cell--match" :class="row.coincide ? 'is-ok' : 'is-no'"><small>{{ row.coincide ? 'Coincidís' : 'No coincidís' }}</small><b class="tnum">{{ row.match }} %</b></span>
                      </div>
                      <div class="evidence-details">
                        <blockquote v-for="(qt, qi) in row.quotes" :key="qi" class="evidence-quote">
                          <p>«{{ qt.translation || qt.text }}»</p>
                          <p v-if="qt.translation" class="evidence-original small">Original: «{{ qt.text }}»</p>
                          <p class="small">
                            <template v-if="row.sourceTitle">{{ row.sourceTitle }}. </template>
                            <a v-if="programLink(result.entityId, qt.page)" :href="programLink(result.entityId, qt.page)!" target="_blank" rel="noopener">Ver en el programa{{ qt.page ? ` (pág. ${qt.page})` : '' }}</a>
                            <span v-else-if="qt.page">Pág. {{ qt.page }}</span>
                          </p>
                        </blockquote>
                        <p v-if="row.evidenceSummary" class="evidence-summary small">{{ row.evidenceSummary }}</p>
                      </div>
                    </li>
                    <li v-if="!sec.rows.length" class="no-evidence small">Ninguna de las preguntas de este tema que te salieron tiene posición documentada de este {{ noun.singular }}.</li>
                  </ul>
                </details>
                <p v-if="!isHistoricalSurvey || programLink(result.entityId, null)" class="small"><a :href="programLink(result.entityId, null) || '/programas'" target="_blank" rel="noopener">Abrir el programa completo de {{ getEntityName(result.entityId) }}</a></p>
              </details>
            </div>
          </li>
        </ol>

        <p v-if="results.length" class="small r__contrib-note">
          Tus respuestas y tu afinidad suman de forma anónima a las <NuxtLink v-if="statsVisible && !isHistoricalSurvey" to="/estadisticas">estadísticas públicas</NuxtLink><template v-else>estadísticas</template>:
          cada respuesta solo añade 1 a un contador, sin IP ni ningún identificador, así que nadie puede saber qué respondiste.
          No se envía nada si tu navegador tiene activado «No rastrear» o el control global de privacidad. <NuxtLink to="/metodologia">Más detalle</NuxtLink>.
        </p>

        <section v-if="results.length" class="r__kofi">
          <p class="small">29N es gratuito, sin anuncios y de código abierto. Si te ha sido útil:</p>
          <KofiButton />
        </section>

        <section v-if="results.length" class="label r__share" aria-labelledby="h-share">
          <div class="label__head"><h2 id="h-share">Comparte tu resultado</h2></div>
          <div class="label__body"><ShareButtons label="Elige cómo enviarlo" :text="shareText" /></div>
        </section>

        <section class="r__actions actions">
          <NuxtLink :to="`/survey/${releaseId}/start`" class="btn-primary">Repetir encuesta</NuxtLink>
          <button type="button" class="btn btn-secondary" @click="saveToLocal">{{ $t('survey.results.save') }}</button>
          <button type="button" class="btn btn-secondary" @click="exportResults">{{ $t('survey.results.export') }}</button>
          <NuxtLink to="/" class="btn btn-secondary">{{ $t('common.back') }}</NuxtLink>
        </section>

        <p class="disclaimer small">Este resultado se calcula en tu navegador. Al servidor solo llegan recuentos anónimos para las estadísticas, nunca tus respuestas como tales. La compatibilidad refleja coincidencia con los programas, no es una recomendación de voto.</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { calculateScoring } from '~/lib/scoring/calculate'
import type { Answer, Position, Question, Weight, EntityInfo, DimensionCalibration, ScoringResult } from '~/lib/scoring/calculate'
import { MIN_EVALUABLE_QUESTIONS, MIN_COVERAGE_PERCENT, isLowCoverage, sortResults } from '~/lib/scoring/ranking'
import { programUrl } from '~/lib/programs'

const route = useRoute()
const releaseId = (route.params.slug || route.params.id || '') as string

const results = ref<ScoringResult[]>([])
const releaseData = ref<any>(null)
const coverageWarning = ref<string | null>(null)
const evidenceMap = ref<Record<string, any>>({})

// Load survey progress from IndexedDB (client-side only)
const { getProgress } = await import('~/lib/storage/indexeddb')

const loading = ref(true)
const progress = ref<any>(null)

if (import.meta.client) {
  const loaded = await getProgress(releaseId)
  if (!loaded) {
    // No progress found, redirect to start
    navigateTo(`/survey/${releaseId}/start`)
  } else {
    progress.value = loaded
    // Estadística anónima: una vez por encuesta terminada (sin respuestas ni resultados)
    try {
      const key = `tracked-complete-${loaded.local_id}`
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        track('survey_completed', releaseId, {
          mode: loaded.depthMode,
          questionCount: (loaded.questions || []).length,
          answered: Object.keys(loaded.answers || {}).length,
          skipped: (loaded.skippedQuestions || []).length,
          partiesCount: (loaded.selectedEntities || []).length
        })
      }
    } catch { /* sin efecto */ }
  }
  loading.value = false
}

// Fetch release data for entity names and evidence details
try {
  const { data } = await useFetch(`/data/releases/${releaseId}.json`)
  releaseData.value = data.value
  
  // Build evidence map: position key → evidence details
  if (data.value?.positions) {
    for (const p of data.value.positions) {
      const key = `${p.entityId}:${p.questionId}`
      // Releases nuevos traen `evidence` (todas las citas aprobadas); los antiguos, una sola cita (claimText)
      const quotes = p.evidence?.length ? p.evidence : (p.claimText ? [{ text: p.claimText, page: p.claimPage }] : [])
      if (p.claimId || quotes.length) {
        evidenceMap.value[key] = {
          claimId: p.claimId,
          quotes,
          sourceTitle: p.sourceTitle,
          evidenceSummary: p.evidenceSummary
        }
      }
    }
  }
} catch (e) {
  // Release data not available
}

// Calculate scoring client-side
if (progress.value?.answers) {
  const config = progress.value
  
  // Build answers array
  const answers: Answer[] = config.answers.map((a: any) => ({
    questionId: a.questionId,
    value: a.value,
    skipped: a.skipped
  }))
  
  // Build weights array
  const weights: Weight[] = (config.weights || []).map((w: any) => ({
    questionId: w.questionId,
    importance: w.importance
  }))
  
  // Build entities array
  const entities: EntityInfo[] = (config.entities || []).map((e: any) => ({
    entityId: e.entityId,
    historical: e.isHistorical || false
  }))
  
  // Build questions array
  const questions: Question[] = (config.questions || []).map((q: any) => ({
    questionId: q.questionId,
    dimensionId: q.dimensionId
  }))
  
  // Build dimension names map
  const dimensionNames: Record<string, string> = {}
  for (const dim of (config.dimensions || [])) {
    dimensionNames[dim.dimensionId] = dim.name
  }
  
  // Build positions array (only for selected entities)
  const positions: Position[] = (config.positions || [])
    .filter((p: any) => config.selectedEntities.includes(p.entityId))
    .map((p: any) => ({
      entityId: p.entityId,
      questionId: p.questionId,
      value: p.value ?? 0,
      status: p.stanceStatus as Position['status'],
      conditions: p.conditions,
      evidenceRef: p.claimId
    }))
  
  // Build calibration
  let calibration: DimensionCalibration | undefined
  if (config.calibrationMode === 'serious' && config.calibrationWeights) {
    calibration = {
      mode: 'serious',
      weights: config.calibrationWeights
    }
  } else if (config.calibrationMode === 'quick' && config.calibrationWeights) {
    calibration = {
      mode: 'quick',
      weights: config.calibrationWeights
    }
  }
  // 'skipped' = no calibration, equal weights
  
  // Calculate!
  results.value = calculateScoring(
    answers,
    positions,
    weights,
    entities,
    questions,
    dimensionNames,
    calibration
  )
  
  // Check coverage warning
  if (results.value.length > 0) {
    const avgCoverage = results.value.reduce((sum, r) => sum + r.coveragePercent, 0) / results.value.length
    if (avgCoverage < 20) {
      coverageWarning.value = `La cobertura media es del ${Math.round(avgCoverage)}%. Los resultados pueden no ser representativos.`
    }
  }
}

// El orden y la marca de «pocos datos» viven en ~/lib/scoring/ranking para poder probarlos.
// Con pocos datos el resultado es orientativo y no debe encabezar la clasificación.

const answeredCount = computed(() => Object.keys(progress.value?.answers || {}).length)
const priorityList = computed(() => {
  const w = progress.value?.calibrationWeights as Record<string, number> | undefined
  if (!w || progress.value?.calibrationMode === 'skipped') return []
  const names: Record<string, string> = {}
  for (const d of (progress.value?.dimensions || [])) names[d.dimensionId] = d.name
  return Object.entries(w)
    .map(([id, v]) => ({ name: names[id] || id, percent: Math.round(v * 100) }))
    .sort((a, b) => b.percent - a.percent)
})

// Ajustes de la encuesta (vienen congelados en la versión publicada): tipo, umbral de «pocos datos», nombre y sustantivo
const survey = computed(() => releaseData.value?.consultation ?? {})
const isHistoricalSurvey = computed(() => survey.value.kind === 'historical')
const minEval = computed<number>(() => survey.value.minEvaluableQuestions ?? MIN_EVALUABLE_QUESTIONS)
const noun = computed<{ singular: string; plural: string }>(() => survey.value.entityNoun ?? { singular: 'partido', plural: 'partidos' })
const shortName = computed<string>(() => survey.value.shortName ?? '29N')
const minCov = computed<number>(() => survey.value.minCoveragePercent ?? MIN_COVERAGE_PERCENT)
const low = (r: ScoringResult) => isLowCoverage(r, minEval.value, minCov.value)
// En la encuesta histórica todas las entidades son históricas: no se excluyen
const counts = (r: ScoringResult) => isHistoricalSurvey.value || !r.historical

const sortedResults = computed(() => sortResults(results.value, minEval.value, minCov.value))

// Texto para compartir: los tres primeros con datos suficientes. Quien comparte es quien decide enviarlo,
// y el texto aclara que no es una recomendación de voto (o, en la histórica, que no es adhesión a un régimen).
// Los que tienen pocos datos no entran; solo en la histórica, si todos los tienen, se comparten los primeros.
const shareText = computed(() => {
  const withData = sortedResults.value.filter(r => r.affinityPercent !== null && counts(r))
  // Si todos tienen pocos datos, mejor enseñar los primeros (ya van marcados en la pantalla) que no enseñar nada
  const solid = withData.filter(r => !low(r))
  const top = (solid.length || !isHistoricalSurvey.value ? solid : withData)
    .slice(0, 3)
    .map(r => `${getEntityName(r.entityId)} ${Math.round(r.affinityPercent as number)} %`)
  const head = top.length ? `Mi resultado en ${shortName.value}: ${top.join(', ')}.` : `He hecho el test de ${shortName.value}.`
  const tail = isHistoricalSurvey.value
    ? 'Es solo la coincidencia con textos históricos, no la adhesión a ningún régimen. Haz el tuyo:'
    : 'Es solo la coincidencia con lo que dicen sus programas, no una recomendación de voto. Haz el tuyo:'
  return `${head} ${tail}`
})

// Aportación anónima a las estadísticas: automática al ver el resultado, una vez por encuesta terminada.
// Solo suma contadores (sin IP ni identificadores). Respeta «No rastrear». Nunca interrumpe la página.
const statsVisible = useStatsVisible()
let contributed = false
async function sendContribution() {
  if (contributed || !progress.value || !results.value.length) return
  contributed = true
  try {
    if (privacyOptOut()) return
    const key = `contributed-${progress.value.local_id}`
    if (localStorage.getItem(key)) return
    const withData = sortedResults.value.filter(r => r.affinityPercent !== null && counts(r))
    const top = withData.find(r => !low(r))
    const ok = await contribute({
      releaseId,
      mode: progress.value.depthMode,
      answers: (progress.value.answers || []).map((a: any) => ({ questionId: a.questionId, value: a.value, skipped: !!a.skipped })),
      // Los que tienen pocos datos no cuentan: su porcentaje es solo orientativo
      affinity: withData.filter(r => !low(r)).map(r => ({ entityId: r.entityId, percent: r.affinityPercent as number })),
      top: top?.entityId ?? null
    })
    if (ok) localStorage.setItem(key, '1')
  } catch { /* sin efecto */ }
}
// Cuando ya están los resultados y los datos de la encuesta (para el umbral y los nombres)
watch([results, releaseData], () => { if (import.meta.client && releaseData.value) sendContribution() }, { immediate: true })

function entityInfo(entityId: string): any {
  return releaseData.value?.entities?.find((e: any) => e.entityId === entityId)
}

function getEntityName(entityId: string): string {
  const entity = releaseData.value?.entities?.find((e: any) => e.entityId === entityId)
  return entity?.name || entityId
}

function affinityClass(percent: number): string {
  if (percent >= 75) return 'high'
  if (percent >= 50) return 'medium'
  if (percent >= 25) return 'low'
  return 'very-low'
}

function getQuestionText(questionId: string): string {
  const q = progress.value?.questions?.find((q: any) => q.questionId === questionId)
  return q?.canonicalText || questionId
}

function getEvidenceForEntity(entityId: string): any[] {
  const evidences: any[] = []
  const questions = progress.value?.questions || []
  for (const q of questions) {
    const key = `${entityId}:${q.questionId}`
    if (evidenceMap.value[key]) {
      evidences.push({ ...evidenceMap.value[key], questionId: q.questionId })
    }
  }
  return evidences
}

const STANCE: Record<number, string> = { [-2]: 'Muy en contra', [-1]: 'En contra', 0: 'Neutral', 1: 'A favor', 2: 'Muy a favor' }
const stanceLabel = (v: number) => STANCE[Math.round(v)] ?? String(v)

const programLink = (entityId: string, page?: number | null) => programUrl(getEntityName(entityId), page)

// Posiciones del programa, las que entran en la encuesta y cuántas coinciden con tu respuesta (a un punto o menos)
function partyRows(entityId: string): any[] {
  const answers = progress.value?.answers
  const list: any[] = Array.isArray(answers) ? answers : []
  const byQ = new Map<string, any>(list.filter((a: any) => !a.skipped).map((a: any) => [a.questionId, a]))
  const qDim = new Map<string, any>((releaseData.value?.questions || []).map((q: any) => [q.questionId, q]))
  const rows: any[] = []
  for (const q of (progress.value?.questions || [])) {
    const pos = (releaseData.value?.positions || []).find((p: any) => p.entityId === entityId && p.questionId === q.questionId)
    if (!pos || pos.value === null || pos.value === undefined) continue
    const a = byQ.get(q.questionId)
    const ev = evidenceMap.value[`${entityId}:${q.questionId}`] || {}
    const diff = a ? Math.abs(a.value - pos.value) : null
    rows.push({
      questionId: q.questionId, text: q.canonicalText,
      dimensionId: (qDim.get(q.questionId) || q).dimensionId, dimensionName: (qDim.get(q.questionId) || q).dimensionName,
      answered: !!a, user: a?.value, party: pos.value,
      match: a ? Math.round((1 - diff! / 4) * 100) : null, coincide: a ? diff! <= 1 : null,
      quotes: ev.quotes || [], sourceTitle: ev.sourceTitle, evidenceSummary: ev.evidenceSummary
    })
  }
  return rows
}
function documentedBySection(entityId: string): Map<string, number> {
  const qDim = new Map<string, string>((releaseData.value?.questions || []).map((q: any) => [q.questionId, q.dimensionId]))
  const m = new Map<string, number>()
  for (const p of (releaseData.value?.positions || [])) {
    if (p.entityId !== entityId || p.value === null || p.value === undefined) continue
    const d = qDim.get(p.questionId); if (!d) continue
    m.set(d, (m.get(d) ?? 0) + 1)
  }
  return m
}
function summary(entityId: string) {
  const rows = partyRows(entityId)
  const answered = rows.filter((r) => r.answered)
  const documented = [...documentedBySection(entityId).values()].reduce((a, b) => a + b, 0)
  return { documented, entered: rows.length, answered: answered.length, coincide: answered.filter((r) => r.coincide).length, discrepan: answered.filter((r) => !r.coincide).length }
}
function sections(entityId: string) {
  const rows = partyRows(entityId).filter((r) => r.answered)
  const documented = documentedBySection(entityId)
  const result = results.value.find((r) => r.entityId === entityId)
  const out: any[] = []
  for (const dim of (releaseData.value?.dimensions || [])) {
    const rs = rows.filter((r) => r.dimensionId === dim.dimensionId)
    const rd = result?.dimensions?.find((d: any) => d.dimensionId === dim.dimensionId)
    out.push({
      dimensionId: dim.dimensionId, name: dim.name, documented: documented.get(dim.dimensionId) ?? 0, entered: rs.length,
      coincide: rs.filter((r) => r.coincide).length, discrepan: rs.filter((r) => !r.coincide).length,
      percent: rd && rs.length ? rd.affinityPercent : null, rows: rs
    })
  }
  return out.filter((s) => s.documented > 0 || s.entered > 0)
}

async function saveToLocal() {
  if (!progress) return
  
  const session = {
    local_id: crypto.randomUUID(),
    survey_release_id: releaseId,
    scoring_model_version: releaseData.value?.scoringModelVersion || '1.0.0',
    entities: progress.value.selectedEntities,
    depth_mode: progress.value.depthMode,
    answers: progress.value.answers,
    weights: progress.value.weights || [],
    results: results.value,
    started_at: progress.value.startedAt,
    completed_at: progress.value.completedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hash: ''
  }
  
  // Save to IndexedDB
  try {
    const { saveSession } = await import('~/lib/storage/indexeddb')
    await saveSession(session)
    alert('Resultados guardados localmente.')
  } catch (e) {
    alert('No se pudieron guardar los resultados.')
  }
}

function exportResults() {
  if (!progress) return
  
  const exportData = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    release_id: releaseId,
    entities: progress.value.selectedEntities,
    depth_mode: progress.value.depthMode,
    calibration_mode: progress.value.calibrationMode,
    answers: progress.value.answers,
    weights: progress.value.weights || [],
    results: results.value
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `afinidad-${releaseId}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.r__pad { padding: var(--space-6) 0; }
.r__body { padding-top: var(--space-4); padding-bottom: var(--space-7); }
.r__alert { font-size: var(--step-0); }
.r__how { border: 1px solid var(--line); border-radius: 12px; background: var(--tile); }
.r__how summary { padding: var(--space-3) var(--space-4); font-weight: 500; cursor: pointer; min-height: 3rem; display: flex; align-items: center; }
.r__how ul { margin: 0; padding: 0 var(--space-4) var(--space-4) calc(var(--space-4) + 1rem); }
.r__how li { margin-top: var(--space-2); }
.results-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
.result-card.is-low { border-style: dashed; border-color: var(--line-strong); }
.entity-name { font-size: 1.6rem; text-transform: none; letter-spacing: -0.03em; font-weight: 500; color: var(--ink); }
.label__head.entity-header h2 { text-transform: none; font-size: 1.6rem; letter-spacing: -0.03em; font-weight: 500; color: var(--ink); }
.low-data-badge { flex: none; padding: 0.15rem 0.7rem; border: 1px solid var(--line-strong); border-radius: 99px; font-size: 0.78rem; font-weight: 600; background: var(--tile); }
.r__score { display: block; }
.r__flag { height: 2.6rem; padding: 0 1rem; justify-content: flex-start; max-width: 100%; }
.score-value { font-size: 1.5rem; font-weight: 500; letter-spacing: -0.02em; line-height: 1; }
.r__stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); margin: var(--space-4) 0 0; }
.r__stats > div { padding: var(--space-3); border-radius: 12px; background: var(--tint); }
.r__stats dt { font-size: 0.8rem; color: var(--muted); line-height: 1.25; }
.r__stats dd { margin: 0.1rem 0 0; font-size: 1.7rem; font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; }
.r__stat--ok dd { color: var(--data); }
.coverage-label { margin: 0; max-width: none; }
.r__det { border-top: 1px solid var(--line); padding-top: var(--space-2); }
.r__det > summary { cursor: pointer; font-weight: 500; min-height: 2.9rem; display: flex; align-items: center; }
/* Cada tema se abre y se cierra por separado: así el detalle de un partido no es un scroll interminable */
.r__sec { margin-top: var(--space-3); border-bottom: 1px solid var(--line); }
.r__sechead { position: relative; display: block; padding: var(--space-2) 2rem var(--space-3) 0; cursor: pointer; list-style: none; min-height: 2.9rem; }
.r__sechead::-webkit-details-marker { display: none; }
.r__sechead::after { content: ""; position: absolute; right: 0.4rem; top: 1.2rem; width: 0.55rem; height: 0.55rem; border-right: 2.5px solid var(--ink); border-bottom: 2.5px solid var(--ink); transform: rotate(45deg); transition: transform 0.2s var(--ease); }
.r__sec[open] > .r__sechead::after { transform: translateY(0.2rem) rotate(-135deg); }
.r__sec[open] > .r__sechead { border-bottom: 1px solid var(--ink); }
.r__sechead:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
.r__sechead h3 { font-size: 1.25rem; letter-spacing: -0.02em; }
.r__sechead p { max-width: none; margin-top: 0.15rem; }
.r__rows { list-style: none; margin: 0; padding: 0; }
.r__row { padding: var(--space-4) 0; border-bottom: 1px solid var(--line); }
.r__row:last-child { border-bottom: 0; }
.r__q { font-weight: 500; line-height: 1.3; }
.r__vs { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); margin: var(--space-3) 0; }
.r__cell { display: grid; gap: 2px; padding: var(--space-2) var(--space-3); border-radius: 10px; background: var(--tint); }
.r__cell small { font-size: 0.75rem; color: var(--muted); }
.r__cell b { font-size: 0.95rem; font-weight: 600; line-height: 1.2; }
.r__cell--match.is-ok { background: var(--data-soft); }
.r__cell--match.is-no { background: #f3dedb; }
.evidence-quote { margin: var(--space-2) 0 0; padding: var(--space-3) var(--space-4); background: var(--tile); border: 1px solid var(--line); border-radius: 12px; }
.evidence-quote p { max-width: none; }
.evidence-quote p + p { margin-top: var(--space-2); }
.evidence-original { color: var(--muted); }
.r__actions { display: grid; gap: var(--space-3); }
.r__actions .btn-primary { order: -1; }
@media (min-width: 40rem) { .r__actions { grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); } .r__actions .btn-primary { grid-column: 1 / -1; } .r__stats { grid-template-columns: repeat(4, 1fr); } }
.r__contrib-note { color: var(--muted); }
.r__hist { margin-top: var(--space-3); }
.r__ficha { color: var(--ink-soft); border-left: 3px solid var(--line-strong); padding-left: var(--space-3); }
.r__kofi { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
</style>
