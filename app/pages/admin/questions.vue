<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Banco de preguntas</h1>
      <button @click="showForm = true" class="btn-primary">+ Nueva pregunta</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filterStatus">
        <option value="">Todos los estados</option>
        <option value="draft">Borrador</option>
        <option value="reviewed">Revisada</option>
        <option value="published">Publicada</option>
      </select>
      <select v-model="filterDepth">
        <option value="">Todas las profundidades</option>
        <option value="1">Rápida</option>
        <option value="2">Normal</option>
        <option value="3">Profunda</option>
      </select>
    </div>

    <!-- Form -->
    <div v-if="showForm" class="form-card">
      <h3>{{ form.id ? 'Editar' : 'Nueva' }} pregunta</h3>
      <div class="form-grid">
        <div class="form-field full-width">
          <label>Texto de la pregunta *</label>
          <textarea v-model="form.canonical_text" rows="3" placeholder="¿Debería aumentarse el IVA?"></textarea>
        </div>
        <div class="form-field">
          <label>Tema</label>
          <select v-model="form.topic_id">
            <option value="">Sin tema</option>
            <option v-for="t in topics" :key="t.id" :value="t.id">
              {{ t.dimension_name }} → {{ t.name }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Profundidad</label>
          <select v-model="form.depth_level">
            <option :value="1">Rápida</option>
            <option :value="2">Normal</option>
            <option :value="3">Profunda</option>
          </select>
        </div>
        <div class="form-field">
          <label>Tipo de respuesta</label>
          <select v-model="form.answer_type">
            <option value="scale">Escala [-2, +2]</option>
            <option value="categorical">Categórica</option>
          </select>
        </div>
        <div class="form-field">
          <label>Estado</label>
          <select v-model="form.status">
            <option value="draft">Borrador</option>
            <option value="reviewed">Revisada</option>
            <option value="published">Publicada</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button @click="save" :disabled="saving">Guardar</button>
        <button @click="cancel" class="btn-secondary">Cancelar</button>
      </div>
    </div>

    <!-- List -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Pregunta</th>
          <th>Tema</th>
          <th>Dimensión</th>
          <th>Profundidad</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="q in questions" :key="q.id">
          <td class="question-text">{{ q.canonical_text }}</td>
          <td>{{ q.topic_name || '—' }}</td>
          <td>{{ q.dimension_name || '—' }}</td>
          <td>{{ ['Rápida', 'Normal', 'Profunda'][q.depth_level - 1] || '—' }}</td>
          <td>
            <span :class="'status-badge status-' + q.status">{{ q.status }}</span>
          </td>
          <td class="actions">
            <button @click="edit(q)" class="btn-small">Editar</button>
            <button @click="remove(q)" class="btn-small btn-danger">Eliminar</button>
          </td>
        </tr>
        <tr v-if="!questions.length">
          <td colspan="6" class="empty">No hay preguntas creadas</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const questions = ref<any[]>([])
const topics = ref<any[]>([])
const showForm = ref(false)
const saving = ref(false)
const filterStatus = ref('')
const filterDepth = ref('')
const form = ref({
  id: '',
  canonical_text: '',
  topic_id: '',
  depth_level: 1,
  answer_type: 'scale',
  status: 'draft'
})

async function load() {
  const params: Record<string, any> = {}
  if (filterStatus.value) params.status = filterStatus.value
  if (filterDepth.value) params.depth_level = filterDepth.value
  const { data } = await useFetch('/api/questions', { query: params })
  questions.value = data.value || []
}

async function loadTopics() {
  const { data } = await useFetch('/api/topics')
  topics.value = data.value || []
}

function edit(q: any) {
  form.value = {
    id: q.id,
    canonical_text: q.canonical_text,
    topic_id: q.topic_id || '',
    depth_level: q.depth_level,
    answer_type: q.answer_type,
    status: q.status
  }
  showForm.value = true
}

function cancel() {
  showForm.value = false
  form.value = { id: '', canonical_text: '', topic_id: '', depth_level: 1, answer_type: 'scale', status: 'draft' }
}

async function save() {
  if (!form.value.canonical_text.trim()) return
  saving.value = true
  try {
    if (form.value.id) {
      await $fetch(`/api/questions/${form.value.id}`, {
        method: 'PATCH',
        body: form.value
      })
    } else {
      await $fetch('/api/questions', {
        method: 'POST',
        body: form.value
      })
    }
    cancel()
    await load()
  } finally {
    saving.value = false
  }
}

async function remove(q: any) {
  if (!confirm('¿Eliminar esta pregunta?')) return
  await $fetch(`/api/questions/${q.id}`, { method: 'DELETE' })
  await load()
}

watch([filterStatus, filterDepth], () => load())
await Promise.all([load(), loadTopics()])
</script>

<style scoped>
.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
}
.filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.filters select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.form-card {
  background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field.full-width { grid-column: 1 / -1; }
.form-field input, .form-field select, .form-field textarea {
  padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;
}
.form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
.data-table th { background: #f5f5f5; font-weight: 600; }
.data-table .empty { text-align: center; color: #999; }
.data-table .actions { display: flex; gap: 0.5rem; }
.question-text { max-width: 400px; }
.status-badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
.status-draft { background: #f3f4f6; color: #374151; }
.status-reviewed { background: #dbeafe; color: #1e40af; }
.status-published { background: #d1fae5; color: #065f46; }
.btn-primary { background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-secondary { background: #e5e5e5; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-small { padding: 0.25rem 0.5rem; font-size: 0.85rem; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
.btn-danger { color: #dc2626; border-color: #dc2626; }
</style>
