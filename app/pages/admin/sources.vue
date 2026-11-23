<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Fuentes documentales</h1>
      <NuxtLink to="/admin/upload" class="btn-primary">+ Subir documento</NuxtLink>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Título</th>
          <th>Entidad</th>
          <th>Tipo</th>
          <th>Estado</th>
          <th>Año</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="source in sources" :key="source.id">
          <td>{{ source.title }}</td>
          <td>{{ source.entity_name }}</td>
          <td>{{ source.type }}</td>
          <td>
            <span :class="'status-badge status-' + source.status">{{ source.status }}</span>
          </td>
          <td>{{ source.year || '—' }}</td>
          <td class="actions">
            <button v-if="source.status === 'uploaded'" @click="extract(source)" class="btn-small">
              Extraer texto
            </button>
            <button @click="viewPassages(source)" class="btn-small">Ver pasajes</button>
            <button @click="remove(source)" class="btn-small btn-danger">Eliminar</button>
          </td>
        </tr>
        <tr v-if="!sources.length">
          <td colspan="6" class="empty">No hay fuentes subidas</td>
        </tr>
      </tbody>
    </table>

    <!-- Extraction progress -->
    <div v-if="extracting" class="progress-bar">
      <p>Extrayendo texto de "{{ extractingTitle }}"...</p>
    </div>

    <!-- Passages modal -->
    <div v-if="showPassages" class="modal-overlay" @click.self="showPassages = false">
      <div class="modal">
        <h3>Pasajes de "{{ currentSource?.title }}"</h3>
        <div class="passages-list">
          <div v-for="(passage, idx) in passages" :key="idx" class="passage-card">
            <div class="passage-header">
              <span class="page-badge">Página {{ passage.page }}</span>
              <span v-if="passage.article_ref" class="article-badge">{{ passage.article_ref }}</span>
            </div>
            <p class="passage-text">{{ passage.literal_text }}</p>
          </div>
          <p v-if="!passages.length" class="empty">No hay pasajes extraídos</p>
        </div>
        <button @click="showPassages = false" class="btn-secondary">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const sources = ref<any[]>([])
const extracting = ref(false)
const extractingTitle = ref('')
const showPassages = ref(false)
const currentSource = ref<any>(null)
const passages = ref<any[]>([])

async function load() {
  const { data } = await useFetch('/api/sources')
  sources.value = data.value || []
}

async function extract(source: any) {
  extracting.value = true
  extractingTitle.value = source.title
  try {
    await $fetch(`/api/documents/${source.id}/extract`, { method: 'POST' })
    await load()
  } catch (e: any) {
    alert('Error al extraer: ' + (e.message || 'Desconocido'))
  } finally {
    extracting.value = false
  }
}

async function viewPassages(source: any) {
  currentSource.value = source
  // Fetch passages from source_passages table
  const { data } = await useFetch(`/api/sources/${source.id}/passages`)
  passages.value = data.value || []
  showPassages.value = true
}

async function remove(source: any) {
  if (!confirm(`¿Eliminar "${source.title}"?`)) return
  await $fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
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
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
.data-table th { background: #f5f5f5; font-weight: 600; }
.data-table .empty { text-align: center; color: #999; }
.data-table .actions { display: flex; gap: 0.5rem; }
.status-badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
.status-uploaded { background: #fef3c7; color: #92400e; }
.status-parsed { background: #dbeafe; color: #1e40af; }
.status-reviewed { background: #d1fae5; color: #065f46; }
.status-accepted { background: #d1fae5; color: #065f46; }
.status-rejected { background: #fee2e2; color: #991b1b; }
.btn-primary { background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; text-decoration: none; }
.btn-small { padding: 0.25rem 0.5rem; font-size: 0.85rem; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
.btn-danger { color: #dc2626; border-color: #dc2626; }
.btn-secondary { background: #e5e5e5; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.progress-bar { margin-top: 1rem; padding: 1rem; background: #dbeafe; border-radius: 8px; }
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal { background: white; padding: 2rem; border-radius: 8px; max-width: 800px; max-height: 80vh; overflow-y: auto; }
.passages-list { margin: 1rem 0; }
.passage-card { padding: 1rem; border: 1px solid #eee; border-radius: 4px; margin-bottom: 0.5rem; }
.passage-header { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.page-badge, .article-badge { background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.8rem; }
.passage-text { white-space: pre-wrap; font-size: 0.9rem; line-height: 1.5; }
</style>
