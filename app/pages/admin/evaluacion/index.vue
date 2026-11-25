<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>Evaluación humana ciega</h1>
        <p class="subtitle">
          Codifica celdas sin ver respuestas de IA, la referencia provisional ni el partido. Evaluador:
          <strong>{{ data?.evaluator.label }}</strong> ({{ data?.evaluator.affiliation === 'internal' ? 'humano interno' : 'humano externo' }}).
        </p>
      </div>
    </div>

    <p v-if="error" class="error" role="alert">{{ error.statusMessage || 'No se pudieron cargar las campañas' }}</p>

    <aside v-for="c in (data?.campaigns ?? []).filter((x: any) => x.provenance?.provenance !== 'human_verified')" :key="'p' + c.id" class="notice warn" role="alert">
      <strong>Procedencia no humana verificada — «{{ c.name }}».</strong> {{ c.provenance?.statement }} Estas filas no se citan como evaluación humana ni como referencia humana.
    </aside>
    <aside class="notice" role="note">
      <strong>Limitación metodológica.</strong> Tus evaluaciones son <em>humanas internas</em>: no constituyen una referencia humana independiente ni permiten
      afirmar concordancia humano–humano. Las campañas dirigidas (como el piloto de 19 celdas) tienen sesgo de selección y no se extrapolan al banco.
    </aside>

    <p v-if="data && !data.campaigns.length" class="hint">No hay campañas asignadas. Se crean con <code>node scripts/methodology/create_eval_campaign.mjs --apply</code>.</p>

    <div v-for="c in data?.campaigns ?? []" :key="c.id" class="form-card campaign">
      <div class="campaign-head">
        <h2>{{ c.name }}</h2>
        <span class="badge" :class="c.status">{{ c.status === 'open' ? 'Abierta' : c.status === 'closed' ? 'Cerrada' : 'Borrador' }}</span>
      </div>
      <p class="hint">{{ c.selection_method }}</p>
      <p class="hint"><strong>Sesgo de selección:</strong> {{ c.selection_bias_note }}</p>
      <div class="progress" role="status">
        <strong>{{ c.finalized }}/{{ c.total }}</strong> finalizadas · {{ c.drafts - c.finalized }} con borrador · manual {{ c.manual_version }}
        <div class="bar-container" aria-hidden="true"><div class="bar" :style="{ width: (c.total ? Math.round((c.finalized / c.total) * 100) : 0) + '%' }" /></div>
      </div>
      <div class="form-actions">
        <NuxtLink :to="`/admin/evaluacion/${c.id}`" class="btn-primary">{{ c.finalized ? 'Continuar' : 'Empezar' }}</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })
interface Campaign { id: string; name: string; kind: string; status: string; manual_version: string; selection_method: string; selection_bias_note: string; total: number; finalized: number; drafts: number }
const { data, error } = await useFetch<{ evaluator: { label: string; affiliation: string }; campaigns: Campaign[] }>('/api/admin/evaluacion')
</script>

<style scoped>
.notice { margin: 0 0 1.25rem; padding: 0.875rem 1rem; border: 1px solid var(--line-strong); border-left: 4px solid var(--accent); border-radius: var(--radius); background: var(--sunken); font-size: 0.9375rem; line-height: 1.5; }
.notice.warn { border-left-color: #b45309; background: #fff6db; }
.campaign { margin-bottom: 1rem; }
.campaign-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.campaign-head h2 { margin: 0; font-size: 1.125rem; }
.badge { padding: 0.125rem 0.625rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: var(--sunken); border: 1px solid var(--line-strong); }
.badge.open { background: var(--accent-tint); border-color: var(--accent); }
.progress { margin: 0.75rem 0; font-size: 0.875rem; color: var(--ink-2); }
.hint { color: var(--ink-3); font-size: 0.8125rem; margin: 0.25rem 0; }
</style>
