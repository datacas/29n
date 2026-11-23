<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Revisión de propuestas</h1>
      <div class="filters">
        <select v-model="filterStatus">
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="machine_checked">Verificado por IA</option>
          <option value="needs_review">Necesita revisión</option>
          <option value="ready_for_batch">Listo para lote</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>
    </div>

    <!-- Batch actions -->
    <div v-if="selectedClaims.length" class="batch-bar">
      <span>{{ selectedClaims.length }} seleccionados</span>
      <button @click="batchApprove" class="btn-small btn-success">Aprobar lote</button>
      <button @click="batchReject" class="btn-small btn-danger">Rechazar lote</button>
      <button @click="selectedClaims = []" class="btn-small">Deseleccionar</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th><input type="checkbox" @change="toggleAll($event)" /></th>
          <th>Propuesta</th>
          <th>Entidad</th>
          <th>Fuente</th>
          <th>Tema</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="claim in claims" :key="claim.id">
          <td>
            <input type="checkbox" :value="claim.id" v-model="selectedClaims" />
          </td>
          <td class="claim-text">{{ claim.literal_text }}</td>
          <td>{{ claim.entity_name }}</td>
          <td>{{ claim.source_title }}</td>
          <td>{{ claim.topic_name || '—' }}</td>
          <td>
            <span :class="'status-badge status-' + claim.status">{{ claim.status }}</span>
          </td>
          <td class="actions">
            <button @click="approve(claim)" class="btn-small btn-success">Aprobar</button>
            <button @click="reject(claim)" class="btn-small btn-danger">Rechazar</button>
          </td>
        </tr>
        <tr v-if="!claims.length">
          <td colspan="7" class="empty">No hay propuestas pendientes</td>
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

const claims = ref<any[]>([])
const filterStatus = ref('')
const selectedClaims = ref<string[]>([])

async function load() {
  const params: Record<string, string> = {}
  if (filterStatus.value) params.status = filterStatus.value
  const { data } = await useFetch('/api/claims', { query: params })
  claims.value = data.value || []
}

function toggleAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  selectedClaims.value = checked ? claims.value.map(c => c.id) : []
}

async function approve(claim: any) {
  await $fetch(`/api/claims/${claim.id}`, {
    method: 'PATCH',
    body: { status: 'approved' }
  })
  await load()
}

async function reject(claim: any) {
  await $fetch(`/api/claims/${claim.id}`, {
    method: 'PATCH',
    body: { status: 'rejected' }
  })
  await load()
}

async function batchApprove() {
  await $fetch('/api/claims/batch', {
    method: 'PATCH',
    body: { ids: selectedClaims.value, status: 'approved' }
  })
  selectedClaims.value = []
  await load()
}

async function batchReject() {
  await $fetch('/api/claims/batch', {
    method: 'PATCH',
    body: { ids: selectedClaims.value, status: 'rejected' }
  })
  selectedClaims.value = []
  await load()
}

watch(filterStatus, () => load())
await load()
</script>

<style scoped>
.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;
}
.filters select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.batch-bar {
  display: flex; gap: 0.5rem; align-items: center; padding: 0.75rem;
  background: #dbeafe; border-radius: 4px; margin-bottom: 1rem;
}
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
.data-table th { background: #f5f5f5; font-weight: 600; }
.data-table .empty { text-align: center; color: #999; }
.data-table .actions { display: flex; gap: 0.5rem; }
.claim-text { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
.status-draft { background: #f3f4f6; color: #374151; }
.status-machine_checked { background: #fef3c7; color: #92400e; }
.status-needs_review { background: #fed7aa; color: #9a3412; }
.status-ready_for_batch { background: #dbeafe; color: #1e40af; }
.status-approved { background: #d1fae5; color: #065f46; }
.status-rejected { background: #fee2e2; color: #991b1b; }
.btn-small { padding: 0.25rem 0.5rem; font-size: 0.85rem; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
.btn-success { color: #059669; border-color: #059669; }
.btn-danger { color: #dc2626; border-color: #dc2626; }
</style>
