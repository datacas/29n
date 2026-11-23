<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>Triaje de revisión (Jev)</h1>
        <p class="subtitle">
          Segunda opinión automática para ordenar el trabajo. No aprueba ni rechaza nada: la decisión sigue siendo humana. «Revisión rápida» = Jev ve la evidencia pertinente y suficiente; en las pruebas casi todas se aprobaron, pero conviene mirarlas igualmente.
        </p>
      </div>
      <div class="filters">
        <select v-model="group" aria-label="Filtrar por grupo">
          <option value="">Todos los grupos ({{ data?.total ?? 0 }})</option>
          <option value="contradictory">Conflicto ({{ data?.counts.contradictory ?? 0 }})</option>
          <option value="doubtful">Revisar con cuidado ({{ data?.counts.doubtful ?? 0 }})</option>
          <option value="high_confidence">Revisión rápida ({{ data?.counts.high_confidence ?? 0 }})</option>
        </select>
      </div>
    </div>

    <p v-if="error" class="error">{{ error.statusMessage || 'No se pudo cargar el triaje' }}</p>

    <div v-else-if="!data?.total" class="form-card">
      <h3>Aún no hay resultados de Jev</h3>
      <p>
        Ejecuta primero el benchmark con etiquetas humanas y después el modo shadow
        (<code>docs/spike-12-jev.md</code>). Hasta entonces esta lista está vacía.
      </p>
    </div>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th>Pregunta</th>
          <th>Partido</th>
          <th>Grupo</th>
          <th>Claude</th>
          <th>Jev</th>
          <th>Motivos</th>
          <th>Revisión</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="i in filtered" :key="i.positionId">
          <td class="q-cell">
            <strong>{{ i.questionId }}</strong>
            <span class="q-text">{{ i.question }}</span>
          </td>
          <td>{{ i.party }}</td>
          <td>
            <span class="status-badge" :class="groupClass[i.group]">{{ groupLabel[i.group] }}</span>
            <small class="n-reasons">{{ i.reasons.length }} {{ i.reasons.length === 1 ? 'motivo' : 'motivos' }}</small>
          </td>
          <td>{{ classLabel(i.claudeClass) }}</td>
          <td>{{ classLabel(i.jevClass) }}</td>
          <td class="reasons">
            <ul>
              <li v-for="(r, idx) in i.reasons" :key="idx">{{ r }}</li>
            </ul>
          </td>
          <td>
            <NuxtLink to="/admin/review-questions" class="btn-small">Abrir revisión</NuxtLink>
          </td>
        </tr>
        <tr v-if="!filtered.length">
          <td colspan="7" class="empty">Ningún resultado con este filtro</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

interface Item {
  positionId: string
  party: string
  questionId: string
  question: string
  claudeClass: string | null
  jevClass: string | null
  group: 'contradictory' | 'doubtful' | 'high_confidence'
  reasons: string[]
}

const { data, error } = await useFetch<{ items: Item[]; counts: Record<string, number>; total: number }>(
  '/api/admin/jev-triage'
)

const group = ref('')
const filtered = computed(() => (data.value?.items ?? []).filter((i) => !group.value || i.group === group.value))

const groupLabel: Record<string, string> = {
  contradictory: 'Conflicto',
  doubtful: 'Revisar con cuidado',
  high_confidence: 'Revisión rápida'
}
const groupClass: Record<string, string> = {
  contradictory: 'status-rejected',
  doubtful: 'status-needs_review',
  high_confidence: 'status-approved'
}
const CLASSES: Record<string, string> = {
  supports: 'Apoya',
  opposes: 'Se opone',
  conditional: 'Condicionada',
  unclear: 'No claro',
  contradictory: 'Contradictoria'
}
const classLabel = (c: string | null) => (c ? (CLASSES[c] ?? c) : 'Se abstiene')
</script>

<style scoped>
.q-cell {
  max-width: 320px;
}
.q-text {
  display: block;
  color: var(--ink-3);
  font-size: 0.8125rem;
}
.btn-small {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  white-space: nowrap;
}
.n-reasons {
  display: block;
  margin-top: 0.25rem;
  color: var(--ink-3);
  font-size: 0.75rem;
}
.reasons ul {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
</style>
