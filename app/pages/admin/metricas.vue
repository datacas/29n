<template>
  <div class="admin-page">
    <div class="page-header"><div>
      <h1>Métricas de concordancia</h1>
      <p class="subtitle">IA–IA, humano–IA, humano–humano y repetibilidad, <strong>siempre por separado</strong>. Alcance: modalidad {{ m?.iaIa.alcance.modalidad }}, conjunto {{ m?.iaIa.alcance.conjunto }} ({{ m?.iaIa.alcance.celdas }} celdas).</p>
    </div></div>
    <p v-if="error" class="error" role="alert">{{ error.statusMessage || 'No se pudieron calcular las métricas' }}</p>
    <template v-if="m">
      <aside class="notice" role="note"><strong>Limitaciones.</strong><ul><li v-for="l in m.limitaciones" :key="l">{{ l }}</li></ul></aside>

      <section v-for="g in m.filasHumanasNoVerificadas" :key="g.procedencia" class="form-card warn">
        <h2>Filas «humanas» NO verificadas ({{ g.procedencia }}) — {{ g.filas }} codificaciones</h2>
        <p><strong>{{ g.aviso }}</strong> Se muestran aparte y no cuentan como humano–IA ni como validación humana.</p>
        <details><summary>Ver como comparación IA–IA</summary>
          <div v-for="e in g.comoIAvsIA" :key="e.evaluador"><h3>{{ e.evaluador }} ({{ e.celdas }} celdas)</h3><PairTable :pairs="e.frente" /></div></details>
      </section>

      <section class="form-card">
        <h2>1. IA–IA</h2>
        <p class="hint">Evaluadores completos: {{ m.iaIa.evaluadoresCompletos.join(', ') || '—' }}. Cobertura: {{ m.iaIa.evaluadoresPorCobertura.map((e: any) => `${e.label} ${e.celdas}`).join(' · ') }}.</p>
        <p v-if="!m.iaIa.evaluable" class="error">No evaluable: {{ m.iaIa.motivo }}</p>
        <template v-else>
          <table class="t"><thead><tr><th /><th>Coeficiente</th><th>IC 95 %</th><th>Gwet</th></tr></thead><tbody>
            <tr><td>Clase documental</td><td>α nominal {{ m.iaIa.clase.alfaNominal }}</td><td>{{ m.iaIa.clase.ic95.join(' – ') }}</td><td>AC1 {{ m.iaIa.clase.gwetAC1 }}</td></tr>
            <tr><td>Intensidad</td><td>α ordinal {{ m.iaIa.intensidad.alfaOrdinal }}</td><td>{{ m.iaIa.intensidad.ic95.join(' – ') }}</td><td>AC2 {{ m.iaIa.intensidad.gwetAC2 }}</td></tr></tbody></table>
          <h3>Por pares</h3><PairTable :pairs="m.iaIa.pares" />
        </template>
      </section>

      <section class="form-card"><h2>2. Humano–IA</h2>
        <p v-if="!m.humanoIa.disponible" class="hint">No disponible: {{ m.humanoIa.motivo }}</p>
        <template v-else><p class="hint">{{ m.humanoIa.nota }}</p><div v-for="e in m.humanoIa.evaluadores" :key="e.evaluador"><h3>{{ e.evaluador }} ({{ e.celdas }} celdas)</h3><PairTable :pairs="e.frente" /></div></template></section>

      <section class="form-card"><h2>3. Humano–humano</h2>
        <p v-if="!m.humanoHumano.disponible" class="hint">No disponible: {{ m.humanoHumano.motivo }}</p>
        <template v-else><p>α nominal {{ m.humanoHumano.clase?.alfaNominal }}</p><PairTable :pairs="m.humanoHumano.pares ?? []" /></template></section>

      <section class="form-card"><h2>4. Repetibilidad intraevaluador</h2>
        <p v-if="!m.repetibilidad.disponible" class="hint">No disponible: {{ m.repetibilidad.motivo }}</p>
        <template v-else><p class="hint">{{ m.repetibilidad.nota }}</p><PairTable :pairs="[m.repetibilidad]" /></template></section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })
const { data: m, error } = await useFetch<any>('/api/admin/metricas')
const PairTable = defineComponent({
  props: { pairs: { type: Array as () => any[], default: () => [] } },
  setup: (props) => () => h('table', { class: 't' }, [
    h('thead', h('tr', ['A', 'B', 'n', 'Clase exacta', 'κ clase', 'Signo disc.', 'n int.', 'Int. exacta', 'MAD', 'κ pond. int.', 'α ord. int.', ''].map((x) => h('th', x)))),
    h('tbody', props.pairs.map((p) => h('tr', [p.a, p.b, p.nClase, p.claseExacta, p.kappaClase ?? '—', p.discrepanciasSigno, p.nIntensidad, p.intensidadExacta ?? '—', p.MAD ?? '—', p.kappaPonderadoIntensidad ?? '—', p.alfaOrdinalIntensidad ?? '—', p.evaluable ? '' : 'NO EVALUABLE (n<10)'].map((x) => h('td', String(x ?? '—'))))))
  ])
})
</script>

<style scoped>
.notice { margin: 0 0 1rem; padding: 0.75rem 1rem; border: 1px solid var(--line-strong); border-left: 4px solid var(--accent); border-radius: var(--radius); background: var(--sunken); font-size: 0.9rem; } .notice ul { margin: 0.25rem 0 0 1rem; padding: 0; }
.form-card.warn { border-left: 4px solid #b45309; background: #fff6db; }
.t { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin-bottom: 0.75rem; } .t th, .t td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--line-strong); text-align: left; } .hint { color: var(--ink-3); font-size: 0.8125rem; }
</style>
