<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Entidades</h1>
      <button @click="showForm = true" class="btn-primary">+ Nueva entidad</button>
    </div>

    <!-- Form -->
    <div v-if="showForm" class="form-card">
      <h3>{{ form.id ? 'Editar' : 'Nueva' }} entidad</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>Nombre *</label>
          <input v-model="form.name" type="text" placeholder="Partido Popular" />
        </div>
        <div class="form-field">
          <label>Tipo</label>
          <select v-model="form.type">
            <option value="party">Partido</option>
            <option value="coalition">Coalición</option>
            <option value="historical">Histórico</option>
            <option value="institutional">Institucional</option>
          </select>
        </div>
        <div class="form-field">
          <label>País</label>
          <input v-model="form.country" type="text" placeholder="España" />
        </div>
        <div class="form-field">
          <label>Período</label>
          <input v-model="form.period_label" type="text" placeholder="2026" />
        </div>
        <div class="form-field full-width">
          <label>Descripción</label>
          <textarea v-model="form.description" rows="2"></textarea>
        </div>
        <div class="form-field">
          <label>
            <input type="checkbox" v-model="form.is_historical" />
            Referencia histórica
          </label>
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
          <th>Nombre</th>
          <th>Tipo</th>
          <th>País</th>
          <th>Período</th>
          <th>Histórico</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entity in entities" :key="entity.id">
          <td>{{ entity.name }}</td>
          <td>{{ entity.type }}</td>
          <td>{{ entity.country || '—' }}</td>
          <td>{{ entity.period_label || '—' }}</td>
          <td>{{ entity.is_historical ? 'Sí' : 'No' }}</td>
          <td class="actions">
            <button @click="edit(entity)" class="btn-small">Editar</button>
            <button @click="remove(entity)" class="btn-small btn-danger">Eliminar</button>
          </td>
        </tr>
        <tr v-if="!entities.length">
          <td colspan="6" class="empty">No hay entidades creadas</td>
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

const entities = ref<any[]>([])
const showForm = ref(false)
const saving = ref(false)
const form = ref({
  id: '',
  name: '',
  type: 'party',
  country: '',
  period_label: '',
  description: '',
  is_historical: false
})

async function load() {
  const { data } = await useFetch('/api/entities')
  entities.value = data.value || []
}

function edit(entity: any) {
  form.value = {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    country: entity.country || '',
    period_label: entity.period_label || '',
    description: entity.description || '',
    is_historical: entity.is_historical
  }
  showForm.value = true
}

function cancel() {
  showForm.value = false
  form.value = { id: '', name: '', type: 'party', country: '', period_label: '', description: '', is_historical: false }
}

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    if (form.value.id) {
      await $fetch(`/api/entities/${form.value.id}`, {
        method: 'PATCH',
        body: form.value
      })
    } else {
      await $fetch('/api/entities', {
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

async function remove(entity: any) {
  if (!confirm(`¿Eliminar "${entity.name}"?`)) return
  await $fetch(`/api/entities/${entity.id}`, { method: 'DELETE' })
  await load()
}

await load()
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.form-card {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field.full-width { grid-column: 1 / -1; }
.form-field input, .form-field select, .form-field textarea {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
.data-table th { background: #f5f5f5; font-weight: 600; }
.data-table .empty { text-align: center; color: #999; }
.data-table .actions { display: flex; gap: 0.5rem; }
.btn-primary { background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-secondary { background: #e5e5e5; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.btn-small { padding: 0.25rem 0.5rem; font-size: 0.85rem; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
.btn-danger { color: #dc2626; border-color: #dc2626; }
</style>
