<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>Revisión editorial de posiciones</h1>
        <p class="subtitle">
          {{ approvedCount }}/{{ totalCount }} posiciones aprobadas ·
          {{ pendingCount }} pendientes ·
          {{ needsReviewCount }} para revisar ·
          {{ rejectedCount }} rechazadas
        </p>
      </div>
      <div class="filters">
        <select v-model="filterQuestion" @change="loadPositions">
          <option value="">Todas las preguntas</option>
          <option v-for="q in questions" :key="q.question_id" :value="q.question_id">
            {{ q.question_id }}: {{ q.question.substring(0, 60) }}...
          </option>
        </select>
        <select v-model="filterParty" @change="loadPositions">
          <option value="">Todos los partidos</option>
          <option v-for="p in parties" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="filterStatus" @change="loadPositions">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
          <option value="needs_review">Necesita revisión</option>
        </select>
      </div>
    </div>

    <p v-if="actionError" class="error action-error" role="alert">{{ actionError }}</p>

    <!-- Coverage summary -->
    <div class="coverage-summary">
      <h3>Cobertura por partido</h3>
      <div class="coverage-bars">
        <div v-for="party in parties" :key="party" class="coverage-item">
          <span class="party-label">{{ party }}</span>
          <div class="bar-container">
            <div
              class="bar"
              :style="{ width: getCoveragePercent(party) + '%' }"
              :class="{ 'low-coverage': getCoveragePercent(party) < 50 }"
            ></div>
          </div>
          <span class="percent">{{ getCoveragePercent(party) }}%</span>
        </div>
      </div>
    </div>

    <!-- Position cards -->
    <div class="position-cards">
      <div v-for="cell in filteredCells" :key="cell.key" class="position-card" :class="'status-' + cell.review_status">
        <div class="card-header">
          <div class="question-info">
            <span class="question-id">{{ cell.question_id }}</span>
            <span class="dimension-badge">{{ cell.dimension }}</span>
          </div>
          <div class="party-status">
            <span class="party-name">{{ cell.party }}</span>
            <span :class="'status-badge status-' + cell.review_status">
              {{ statusLabel(cell.review_status) }}
            </span>
          </div>
        </div>

        <p class="question-text">{{ cell.question }}</p>

        <div v-if="cell.claims.length" class="evidence-section">
          <h4>Evidencia ({{ cell.claims.length }} claims)</h4>
          <div v-for="(claim, idx) in cell.claims" :key="idx" class="claim-item">
            <div class="claim-meta">
              <span class="page">pág {{ claim.source_page }}</span>
              <span v-if="claim.conditions && claim.conditions !== 'ninguna'" class="conditions">
                Cond: {{ claim.conditions.substring(0, 80) }}{{ claim.conditions.length > 80 ? '...' : '' }}
              </span>
              <span v-if="claim.stance" class="stance-badge" :class="'stance-' + claim.stance">
                {{ stanceLabel(claim.stance) }}
              </span>
            </div>
            <p class="literal-text">«{{ claim.literal_text }}»</p>
            <p v-if="claim.translation_es" class="translation"><strong>Traducción:</strong> {{ claim.translation_es }}</p>
            <p v-if="claim.normalized_text" class="normalized-text">{{ claim.normalized_text }}</p>
          </div>
        </div>
        <div v-else class="no-evidence">
          <p>Sin evidencia documental</p>
        </div>

        <p v-if="cell.review_note" class="review-note">Nota de revisión: {{ cell.review_note }}</p>

        <div class="card-actions">
          <button @click="approve(cell)" class="btn-approve" :disabled="cell.review_status === 'approved'">
            ✓ Aprobar
          </button>
          <button @click="reject(cell)" class="btn-reject" :disabled="cell.review_status === 'rejected'">
            ✗ Rechazar
          </button>
          <button @click="requestReview(cell)" class="btn-review">
            Solicitar revisión
          </button>
        </div>
      </div>

      <div v-if="!filteredCells.length" class="empty-state">
        <p>No hay posiciones que mostrar con estos filtros</p>
      </div>
    </div>

    <!-- Release candidate preview -->
    <div v-if="approvedCount > 0" class="release-preview">
      <h3>Candidato de release</h3>
      <p>
        Con las posiciones actuales: {{ approvedCount }} aprobadas de {{ totalCount }} posibles.
        Cobertura efectiva: {{ (approvedCount / totalCount * 100).toFixed(1) }}%
      </p>
      <div class="dimension-coverage">
        <h4>Cobertura por dimensión</h4>
        <div v-for="dim in dimensionCoverage" :key="dim.dimension" class="dim-item">
          <span>{{ dim.dimension }}</span>
          <span>{{ dim.approved }}/{{ dim.total }} aprobadas</span>
        </div>
      </div>
      <button @click="prepareRelease" class="btn-release" :disabled="approvedCount === 0">
        Preparar candidato de release
      </button>
      <p v-if="approvedCount === 0" class="release-warning">
        Aprob al menos una posición para preparar un candidato de release.
      </p>
      <div v-if="releaseWarnings && releaseWarnings.length" class="release-warnings">
        <h4>Advertencias</h4>
        <ul>
          <li v-for="(w, idx) in releaseWarnings" :key="idx">{{ w }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const { t } = useI18n()

const parties = ref<string[]>([])

const questions = ref<any[]>([])
const cells = ref<any[]>([])
const filterQuestion = ref('')
const filterParty = ref('')
const filterStatus = ref('needs_review') // por defecto, lo que falta por revisar

const approvedCount = computed(() => cells.value.filter(c => c.review_status === 'approved').length)
const rejectedCount = computed(() => cells.value.filter(c => c.review_status === 'rejected').length)
const pendingCount = computed(() => cells.value.filter(c => c.review_status === 'pending').length)
const needsReviewCount = computed(() => cells.value.filter(c => c.review_status === 'needs_review').length)
const totalCount = computed(() => cells.value.length)

const filteredCells = computed(() => {
  let result = cells.value
  if (filterQuestion.value) result = result.filter(c => c.question_id === filterQuestion.value)
  if (filterParty.value) result = result.filter(c => c.party === filterParty.value)
  if (filterStatus.value) result = result.filter(c => c.review_status === filterStatus.value)
  return result
})

const dimensionCoverage = computed(() => {
  const dims: Record<string, { approved: number; total: number }> = {}
  for (const cell of cells.value) {
    if (!dims[cell.dimension]) dims[cell.dimension] = { approved: 0, total: 0 }
    dims[cell.dimension].total++
    if (cell.review_status === 'approved') dims[cell.dimension].approved++
  }
  return Object.entries(dims).map(([dimension, data]) => ({ dimension, ...data }))
})

function getCoveragePercent(party: string) {
  const partyCells = cells.value.filter(c => c.party === party)
  if (!partyCells.length) return 0
  const withEvidence = partyCells.filter(c => c.claims.length > 0).length
  return Math.round(withEvidence / partyCells.length * 100)
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    needs_review: 'Necesita revisión',
  }
  return labels[status] || status
}

function stanceLabel(stance: string) {
  const labels: Record<string, string> = {
    agrees: 'A favor',
    disagrees: 'En contra',
    conditional_agrees: 'Condicional',
    unclear: 'No claro',
    not_stated: 'No declarado',
  }
  return labels[stance] || stance
}

async function loadPositions() {
  // Load corrected questions from the question bank
  const { data } = await useFetch('/api/admin/review-questions/data')
  if (data.value) {
    questions.value = data.value.questions || []
    parties.value = data.value.parties || []
    cells.value = buildCells(questions.value)
  }
}

function buildCells(questions: any[]): any[] {
  const cells: any[] = []
  for (const q of questions) {
    for (const party of parties.value) {
      const evidence = q.evidence_by_party?.[party] || []
      const info = q.review_by_party?.[party]
      // Use review_status from evidence, not approved flag
      let reviewStatus = info?.review_status || 'pending'
      if (evidence.length > 0) {
        const statuses = evidence.map((e: any) => e.review_status || 'pending')
        if (statuses.every((s: string) => s === 'approved')) reviewStatus = 'approved'
        else if (statuses.every((s: string) => s === 'rejected')) reviewStatus = 'rejected'
        else if (statuses.some((s: string) => s === 'needs_review')) reviewStatus = 'needs_review'
      }

      cells.push({
        key: `${q.question_id}-${party}`,
        question_id: q.question_id,
        question: q.question,
        area: q.area,
        dimension: q.dimension,
        party,
        claims: evidence.map((e: any) => ({
          literal_text: e.literal_text,
          translation_es: e.translation_es,
          normalized_text: e.normalized_text,
          source_page: e.source_page,
          conditions: e.conditions,
          stance: e.stance,
          review_status: e.review_status || 'pending',
        })),
        review_status: reviewStatus,
        review_note: info?.review_note || null,
      })
    }
  }
  return cells
}

const actionError = ref('')

async function decide(cell: any, action: 'approve' | 'reject' | 'review', status: string) {
  actionError.value = ''
  try {
    await $fetch(`/api/admin/review-questions/${action}`, {
      method: 'POST',
      body: { question_id: cell.question_id, party: cell.party },
    })
    cell.review_status = status
    if (status !== 'needs_review') cell.claims.forEach((c: any) => { c.review_status = status })
  } catch (e: any) {
    actionError.value = `No se pudo guardar ${cell.question_id} · ${cell.party}: ${e?.data?.statusMessage || e?.data?.message || e?.message || 'error desconocido'}`
  }
}

const approve = (cell: any) => decide(cell, 'approve', 'approved')
const reject = (cell: any) => decide(cell, 'reject', 'rejected')
const requestReview = (cell: any) => decide(cell, 'review', 'needs_review')

const releaseWarnings = ref<string[] | null>(null)

async function prepareRelease() {
  actionError.value = ''
  try {
    const data = await $fetch<any>('/api/admin/review-questions/release-candidate', { method: 'POST' })
    releaseWarnings.value = data.warnings || null
    alert(`Candidato de release preparado:\n${data.summary}`)
  } catch (e: any) {
    actionError.value = `No se pudo preparar el candidato: ${e?.data?.statusMessage || e?.message || 'error desconocido'}`
  }
}

await loadPositions()
</script>

<style scoped>
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #666;
  font-size: 0.9rem;
  margin: 0;
}

.filters {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.filters select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.coverage-summary {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.coverage-summary h3 {
  margin: 0 0 1rem 0;
}

.coverage-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.coverage-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.party-label {
  width: 60px;
  font-weight: 600;
}

.bar-container {
  flex: 1;
  height: 20px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s;
}

.bar.low-coverage {
  background: #f59e0b;
}

.percent {
  width: 40px;
  text-align: right;
  font-size: 0.85rem;
  color: #666;
}

.position-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.position-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  background: white;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.question-id {
  font-weight: 700;
  color: #3b82f6;
  margin-right: 0.5rem;
}

.dimension-badge {
  font-size: 0.75rem;
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.party-name {
  font-weight: 600;
  margin-right: 0.5rem;
}

.status-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.status-pending { background: #f3f4f6; color: #374151; }
.status-approved { background: #d1fae5; color: #065f46; }
.status-rejected { background: #fee2e2; color: #991b1b; }
.status-needs_review { background: #fef3c7; color: #92400e; }

.question-text {
  font-size: 1.05rem;
  margin: 0 0 1rem 0;
  color: #1f2937;
}

.evidence-section {
  margin: 1rem 0;
}

.evidence-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #6b7280;
}

.claim-item {
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.claim-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.page {
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.conditions {
  color: #92400e;
  background: #fef3c7;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.stance-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

.stance-agrees { background: #d1fae5; color: #065f46; }
.stance-disagrees { background: #fee2e2; color: #991b1b; }
.stance-conditional_agrees { background: #fef3c7; color: #92400e; }
.stance-unclear { background: #f3f4f6; color: #374151; }

.literal-text {
  font-style: italic;
  margin: 0 0 0.25rem 0;
  color: #374151;
}

.normalized-text {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
}

.no-evidence {
  padding: 1rem;
  text-align: center;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 4px;
}

.review-note {
  margin: 0.75rem 0 0 0;
  padding: 0.6rem 0.8rem;
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #92400e;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.btn-approve, .btn-reject, .btn-review {
  padding: 0.4rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-approve { color: #059669; border-color: #059669; }
.btn-reject { color: #dc2626; border-color: #dc2626; }
.btn-review { color: #d97706; border-color: #d97706; }

.btn-approve:disabled, .btn-reject:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
}

.release-preview {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
}

.release-preview h3 {
  margin: 0 0 0.5rem 0;
  color: #166534;
}

.dimension-coverage {
  margin: 1rem 0;
}

.dimension-coverage h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
}

.dim-item {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.85rem;
  color: #374151;
}

.btn-release {
  padding: 0.6rem 1.2rem;
  background: #059669;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  margin-top: 0.5rem;
}

.btn-release:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.release-warning {
  color: #92400e;
  font-size: 0.85rem;
  margin: 0.5rem 0 0 0;
}
</style>
