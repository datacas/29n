<template>
  <div class="stats">
    <h1>Estadísticas de uso</h1>
    <p class="note">Recuentos anónimos: no se guarda IP, ni respuestas, ni resultados. Se ignora a quien tiene activado «No rastrear».</p>
    <p v-if="error" class="err">No se pudieron cargar las estadísticas.</p>
    <template v-else-if="data">
      <div class="cards">
        <div class="card"><b>{{ data.started }}</b><span>Encuestas iniciadas</span></div>
        <div class="card"><b>{{ data.completed }}</b><span>Encuestas terminadas</span></div>
        <div class="card"><b>{{ data.completionRate === null ? '–' : data.completionRate + ' %' }}</b><span>Las terminan</span></div>
      </div>
      <div class="cols">
        <section>
          <h2>Por día</h2>
          <table><thead><tr><th>Día</th><th>Inician</th><th>Terminan</th></tr></thead>
            <tbody><tr v-for="d in data.days" :key="d.day"><td>{{ d.day }}</td><td>{{ d.started }}</td><td>{{ d.completed }}</td></tr>
              <tr v-if="!data.days.length"><td colspan="3">Todavía no hay datos.</td></tr></tbody></table>
        </section>
        <section>
          <h2>Partidos más elegidos</h2>
          <table><tbody><tr v-for="p in data.parties" :key="p.party"><td>{{ p.party }}</td><td>{{ p.n }}</td></tr>
            <tr v-if="!data.parties.length"><td>Todavía no hay datos.</td></tr></tbody></table>
        </section>
        <section>
          <h2>Profundidad y dispositivo</h2>
          <table><tbody>
            <tr v-for="m in data.modes" :key="'m'+m.mode"><td>{{ modeLabel(m.mode) }}</td><td>{{ m.n }}</td></tr>
            <tr v-for="d in data.devices" :key="'d'+d.device"><td>{{ d.device === 'mobile' ? 'Móvil' : 'Ordenador' }}</td><td>{{ d.n }}</td></tr>
          </tbody></table>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { data, error } = await useFetch<any>('/api/admin/stats')
const modeLabel = (m: string) => ({ quick: 'Rápida', normal: 'Normal', deep: 'Profunda' } as Record<string, string>)[m] ?? m
</script>

<style scoped>
.note { color: #666; font-size: 0.9rem; }
.err { color: #b00020; }
.cards { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0 1.5rem; }
.card { flex: 1 1 150px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; background: #fff; }
.card b { display: block; font-size: 1.8rem; }
.card span { color: #666; font-size: 0.85rem; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
table { width: 100%; border-collapse: collapse; }
td, th { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
</style>
