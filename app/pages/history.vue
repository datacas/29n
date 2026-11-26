<template>
  <div class="history-page">
    <section class="band on-band">
      <div class="wrap band__inner">
        <h1>{{ $t('history.title') }}</h1>
        <p>Los resultados que guardaste se quedan solo en este navegador.</p>
      </div>
    </section>

    <div class="wrap stack-lg hist__body">
      <div class="toolbar hist__tools">
        <label class="btn btn-import" for="import-file" tabindex="0" @keydown.enter.prevent="($event.currentTarget as HTMLElement).click()">
          {{ $t('history.import') }}
          <input id="import-file" type="file" accept=".json" class="visually-hidden" @change="handleImport" />
        </label>
        <button v-if="sessions.length" type="button" class="btn btn-export" @click="handleExport">Exportar todo</button>
      </div>

      <p v-if="!sessions.length" class="note empty" role="status">{{ $t('history.empty') }}</p>

      <ul v-else class="results-list hist__list">
        <li v-for="session in sessions" :key="session.local_id" class="result-card label">
          <div class="label__head result-header">
            <h2>Test {{ session.survey_release_id.slice(0, 8) }}</h2>
            <span class="meta date">{{ formatDate(session.completed_at) }}</span>
          </div>
          <div class="label__body stack">
            <p class="result-meta small">{{ session.entities.length }} partidos · {{ ({ quick: 'Rápida', normal: 'Normal', deep: 'Profunda', total: 'Total' } as Record<string, string>)[session.depth_mode] ?? 'Profunda' }}</p>
            <div class="result-actions hist__actions">
              <button type="button" class="btn btn-small" @click="exportSession(session)">{{ $t('history.export') }}</button>
              <button type="button" class="btn btn-small btn-delete" @click="deleteSession(session.local_id)">{{ $t('history.delete') }}</button>
            </div>
          </div>
        </li>
      </ul>

      <p v-if="sessions.length" class="note warning">Si borras los datos de navegación, perderás estos resultados. Exporta una copia como respaldo.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAllSessions, deleteSession as deleteSessionDb, saveSession } from '~/lib/storage/indexeddb'
import { exportSessions, importSessions } from '~/lib/export/json'
import type { LocalSurveySession } from '~/lib/storage/indexeddb'

const sessions = ref<LocalSurveySession[]>([])

onMounted(async () => {
  try {
    sessions.value = await getAllSessions()
    // Sort by completed_at descending
    sessions.value.sort((a, b) => {
      const aDate = a.completed_at || a.started_at
      const bDate = b.completed_at || b.started_at
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })
  } catch (e) {
    // IndexedDB not available
  }
})

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Sin completar'
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function exportSession(session: LocalSurveySession) {
  try {
    const json = await exportSessions([session])
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `afinidad-${session.local_id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Error al exportar: ' + (e as Error).message)
  }
}

async function handleExport() {
  try {
    const json = await exportSessions(sessions.value)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `afinidad-todo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Error al exportar: ' + (e as Error).message)
  }
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const imported = await importSessions(text)
    for (const session of imported) {
      await saveSession(session)
    }
    sessions.value = await getAllSessions()
    alert(`${imported.length} resultado(s) importado(s).`)
  } catch (e) {
    alert('Error al importar: ' + (e as Error).message)
  }
  
  // Reset file input
  input.value = ''
}

async function deleteSession(localId: string) {
  if (!confirm('¿Eliminar este resultado?')) return
  try {
    await deleteSessionDb(localId)
    sessions.value = sessions.value.filter(s => s.local_id !== localId)
  } catch (e) {
    alert('Error al eliminar.')
  }
}
</script>

<style scoped>
.hist__body { padding-top: var(--space-5); padding-bottom: var(--space-7); }
.hist__tools { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.hist__list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
.label__head h2 { font-size: var(--step-1); }
.hist__actions { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.btn-delete { color: var(--danger); border-color: var(--danger); }
.btn-import:focus-within { outline: 3px solid var(--focus); outline-offset: 2px; }
</style>
