<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>Adjudicación (en sombra)</h1>
        <p class="subtitle">Revisa las celdas con discrepancias, posibles omisiones y diferencias de intensidad. Cada decisión se registra como nueva (solo añadir) y <strong>no modifica</strong> las posiciones ni el banco publicado.</p>
      </div>
    </div>
    <aside class="notice" role="note">
      <strong>Zona no ciega:</strong> aquí ves la referencia provisional y las respuestas de IA. No se resuelve por mayoría. Tus evaluaciones son humanas internas (no una referencia independiente); la muestra es dirigida y no se extrapola al banco.
    </aside>
    <p v-if="error" class="error" role="alert">{{ error.statusMessage || 'No se pudo cargar la cola' }}</p>
    <table v-if="data" class="review-table">
      <thead><tr><th>Prioridad</th><th>Celda</th><th>Motivos</th><th>Estado</th><th>Decisión vigente</th><th>Causas</th><th /></tr></thead>
      <tbody>
        <tr v-for="i in data.items" :key="i.cellId">
          <td>{{ i.priority }}</td><td>{{ i.ord }}</td><td>{{ i.reasons.join('; ') }}</td>
          <td>{{ i.status === 'adjudicada' ? `Adjudicada (rev. ${i.revision})` : 'Pendiente' }}</td>
          <td>{{ i.documentClass ? `${i.documentClass} ${i.intensity ?? ''}` : (i.revision ? 'sin resolver' : '—') }}</td>
          <td>{{ (i.causes ?? []).map((c: string) => CAUSE_LABEL[c] ?? c).join(', ') || '—' }}</td>
          <td><NuxtLink :to="`/admin/adjudicacion/${i.cellId}`" class="btn-secondary small">Abrir</NuxtLink></td>
        </tr>
      </tbody>
    </table>
    <section v-if="data && Object.keys(data.causeCounts).length" class="form-card">
      <h2>Causas registradas (diagnóstico)</h2>
      <ul><li v-for="(n, c) in data.causeCounts" :key="c"><strong>{{ CAUSE_LABEL[c as string] ?? c }}</strong>: {{ n }}</li></ul>
      <p class="hint">Una celda puede tener varias causas. Sirve para saber qué falla (recuperación, interpretación, manual, ítem…), no solo para corregir puntuaciones.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })
const CAUSE_LABEL: Record<string, string> = {
  retrieval_error: 'Error de recuperación documental', interpretation_error: 'Error de interpretación', intensity_error: 'Error de intensidad',
  insufficient_evidence: 'Evidencia insuficiente', contradictory_evidence: 'Evidencia contradictoria', ambiguous_question: 'Pregunta ambigua o defectuosa',
  manual_insufficient: 'Manual de codificación insuficiente', omitted_position: 'Posición omitida', unsupported_registered_position: 'Posición registrada sin respaldo suficiente',
  reasonable_disagreement: 'Desacuerdo razonable entre evaluadores', other: 'Otra causa justificada'
}
const { data, error } = await useFetch<{ items: any[]; causeCounts: Record<string, number> }>('/api/admin/adjudicacion')
</script>

<style scoped>
.notice { margin: 0 0 1.25rem; padding: 0.875rem 1rem; border: 1px solid var(--line-strong); border-left: 4px solid var(--accent); border-radius: var(--radius); background: var(--sunken); font-size: 0.9375rem; line-height: 1.5; }
.review-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin-bottom: 1.5rem; } .review-table th, .review-table td { padding: 0.5rem; border-bottom: 1px solid var(--line-strong); text-align: left; vertical-align: top; }
.small { padding: 0.125rem 0.625rem; font-size: 0.8125rem; } .hint { color: var(--ink-3); font-size: 0.8125rem; }
</style>
