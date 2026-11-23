<template>
  <div class="admin-page">
    <h1>Subir documento</h1>
    <div class="upload-card">
      <div class="form-grid">
        <div class="form-field">
          <label>Entidad *</label>
          <select v-model="form.entity_id">
            <option value="">Seleccionar entidad...</option>
            <option v-for="e in entities" :key="e.id" :value="e.id">{{ e.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>Tipo de documento</label>
          <select v-model="form.type">
            <option value="program">Programa electoral</option>
            <option value="constitution">Constitución</option>
            <option value="manifesto">Manifiesto</option>
          </select>
        </div>
        <div class="form-field">
          <label>Título</label>
          <input v-model="form.title" type="text" placeholder="Programa electoral 2026" />
        </div>
        <div class="form-field">
          <label>Año</label>
          <input v-model="form.year" type="number" placeholder="2026" />
        </div>
        <div class="form-field full-width">
          <label>Archivo PDF *</label>
          <input type="file" @change="onFileChange" accept=".pdf,application/pdf" />
          <p v-if="selectedFile" class="file-info">{{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})</p>
        </div>
      </div>
      <button @click="upload" :disabled="uploading || !form.entity_id || !selectedFile" class="btn-primary">
        {{ uploading ? 'Subiendo...' : 'Subir documento' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">Documento subido correctamente</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const entities = ref<any[]>([])
const form = ref({ entity_id: '', type: 'program', title: '', year: '' })
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const error = ref('')
const success = ref(false)

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  selectedFile.value = file || null
  if (file && !form.value.title) {
    form.value.title = file.name.replace('.pdf', '')
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadEntities() {
  const { data } = await useFetch('/api/entities')
  entities.value = data.value || []
}

async function upload() {
  if (!selectedFile.value || !form.value.entity_id) return
  uploading.value = true
  error.value = ''
  success.value = false

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('entity_id', form.value.entity_id)
    formData.append('title', form.value.title)
    formData.append('type', form.value.type)
    if (form.value.year) formData.append('year', form.value.year)

    await $fetch('/api/documents/upload', {
      method: 'POST',
      body: formData
    })
    success.value = true
    selectedFile.value = null
    form.value = { entity_id: '', type: 'program', title: '', year: '' }
    setTimeout(() => navigateTo('/admin/sources'), 1500)
  } catch (e: any) {
    error.value = e.message || 'Error al subir'
  } finally {
    uploading.value = false
  }
}

await loadEntities()
</script>

<style scoped>
.upload-card {
  background: #f9f9f9; padding: 2rem; border-radius: 8px; max-width: 700px;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field.full-width { grid-column: 1 / -1; }
.form-field input, .form-field select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.file-info { font-size: 0.85rem; color: #666; margin-top: 0.25rem; }
.btn-primary { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #dc2626; margin-top: 1rem; }
.success { color: #059669; margin-top: 1rem; }
</style>
