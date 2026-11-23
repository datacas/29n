<template>
  <div class="positions-page">
    <div class="page-header">
      <h1>Posiciones</h1>
      <p>Gestiona las posiciones de entidades para cada pregunta.</p>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filters.entity_id" @change="fetchPositions">
        <option value="">Todas las entidades</option>
        <option v-for="entity in entities" :key="entity.id" :value="entity.id">
          {{ entity.name }}
        </option>
      </select>
      <select v-model="filters.question_id" @change="fetchPositions">
        <option value="">Todas las preguntas</option>
        <option v-for="q in questions" :key="q.id" :value="q.id">
          {{ q.canonical_text.substring(0, 60) }}...
        </option>
      </select>
      <select v-model="filters.review_status" @change="fetchPositions">
        <option value="">Todos los estados</option>
        <option value="draft">Borrador</option>
        <option value="machine_checked">Revisado por IA</option>
        <option value="needs_review">Necesita revisión</option>
        <option value="approved">Aprobado</option>
        <option value="rejected">Rechazado</option>
      </select>
    </div>

    <!-- Add position form -->
    <div class="add-form">
      <h2>Nueva posición</h2>
      <div class="form-grid">
        <select v-model="form.entity_id" required>
          <option value="">Seleccionar entidad</option>
          <option v-for="entity in entities" :key="entity.id" :value="entity.id">
            {{ entity.name }}
          </option>
        </select>
        <select v-model="form.question_id" required>
          <option value="">Seleccionar pregunta</option>
          <option v-for="q in questions" :key="q.id" :value="q.id">
            {{ q.canonical_text.substring(0, 60) }}
          </option>
        </select>
        <div class="value-input">
          <label>Valor (-2 a 2)</label>
          <input type="number" v-model.number="form.value" min="-2" max="2" step="1" />
        </div>
        <select v-model="form.stance_status">
          <option value="approved">Aprobado</option>
          <option value="explicit_neutral">Neutral explícito</option>
          <option value="ambiguous">Ambiguo</option>
          <option value="not_stated">No declarado</option>
          <option value="conditional">Condicional</option>
          <option value="not_comparable">No comparable</option>
        </select>
        <input v-model="form.evidence_summary" placeholder="Resumen de evidencia" />
        <input v-model="form.conditions" placeholder="Condiciones" />
      </div>
      <button @click="addPosition" :disabled="!form.entity_id || !form.question_id">
        Añadir posición
      </button>
    </div>

    <!-- Positions list -->
    <div class="positions-list">
      <table v-if="positions.length">
        <thead>
          <tr>
            <th>Entidad</th>
            <th>Pregunta</th>
            <th>Valor</th>
            <th>Estado revisión</th>
            <th>Estado posición</th>
            <th>Evidencia</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pos in positions" :key="pos.id">
            <td>{{ pos.entity_name }}</td>
            <td>{{ pos.question_text?.substring(0, 50) }}...</td>
            <td>{{ pos.value }}</td>
            <td>
              <span :class="'status-badge ' + pos.review_status">
                {{ statusLabel(pos.review_status) }}
              </span>
            </td>
            <td>
              <span :class="'stance-badge ' + pos.stance_status">
                {{ stanceLabel(pos.stance_status) }}
              </span>
            </td>
            <td>{{ pos.evidence_summary?.substring(0, 40) || '—' }}</td>
            <td>
              <select v-model="pos.review_status" @change="updatePosition(pos)">
                <option value="draft">Borrador</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
                <option value="needs_review">Necesita revisión</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty-state">No hay posiciones que mostrar.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const positions = ref([])
const entities = ref([])
const questions = ref([])
const filters = ref({ entity_id: '', question_id: '', review_status: '' })
const form = ref({
  entity_id: '',
  question_id: '',
  value: 0,
  stance_status: 'approved',
  evidence_summary: '',
  conditions: '',
})

const statusLabel = (status) => {
  const labels = {
    draft: 'Borrador',
    machine_checked: 'Revisado IA',
    needs_review: 'Necesita revisión',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  }
  return labels[status] || status
}

const stanceLabel = (status) => {
  const labels = {
    approved: 'Aprobado',
    explicit_neutral: 'Neutral',
    ambiguous: 'Ambiguo',
    not_stated: 'No declarado',
    conditional: 'Condicional',
    not_comparable: 'No comparable',
  }
  return labels[status] || status
}

async function fetchEntities() {
  const res = await $fetch('/api/entities')
  entities.value = res
}

async function fetchQuestions() {
  const res = await $fetch('/api/questions')
  questions.value = res
}

async function fetchPositions() {
  const params = {}
  if (filters.value.entity_id) params.entity_id = filters.value.entity_id
  if (filters.value.question_id) params.question_id = filters.value.question_id
  if (filters.value.review_status) params.review_status = filters.value.review_status
  const res = await $fetch('/api/positions', { query: params })
  positions.value = res
}

async function addPosition() {
  await $fetch('/api/positions', {
    method: 'POST',
    body: form.value,
  })
  form.value = { entity_id: '', question_id: '', value: 0, stance_status: 'approved', evidence_summary: '', conditions: '' }
  await fetchPositions()
}

async function updatePosition(pos) {
  await $fetch(`/api/positions/${pos.id}`, {
    method: 'PATCH',
    body: { review_status: pos.review_status },
  })
}

onMounted(async () => {
  await Promise.all([fetchEntities(), fetchQuestions(), fetchPositions()])
})
</script>

<style scoped>
.positions-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
.filters {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}
.filters select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.add-form {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.form-grid select,
.form-grid input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 0.5rem;
  border: 1px solid #ddd;
  text-align: left;
}
.status-badge, .stance-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}
.status-badge-approved { background: #d4edda; color: #155724; }
.status-badge-draft { background: #fff3cd; color: #856404; }
.status-badge-rejected { background: #f8d7da; color: #721c24; }
.status-badge-needs_review { background: #cce5ff; color: #004085; }
.empty-state {
  text-align: center;
  color: #666;
  padding: 2rem;
}
</style>
