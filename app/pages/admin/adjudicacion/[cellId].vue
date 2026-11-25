<template>
  <div class="admin-page adj">
    <div class="page-header">
      <div>
        <h1>Adjudicación — celda {{ d?.ord }} <small v-if="d">· {{ d.dossier.party }} ({{ d.dossier.language }})</small></h1>
        <p class="subtitle"><NuxtLink to="/admin/adjudicacion">← Cola</NuxtLink> · Prioridad {{ d?.priority }} · {{ d?.reasons?.join('; ') }}</p>
      </div>
      <div v-if="d" class="nav">
        <NuxtLink v-if="prevId" :to="`/admin/adjudicacion/${prevId}`" class="btn-secondary">← Anterior</NuxtLink>
        <NuxtLink v-if="nextId" :to="`/admin/adjudicacion/${nextId}`" class="btn-secondary">Siguiente →</NuxtLink>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">{{ error.statusMessage || 'No se pudo cargar' }}</p>

    <template v-if="d">
      <aside class="notice" role="note">Zona no ciega y <strong>en sombra</strong>: nada de esto modifica positions ni el banco. No se resuelve por mayoría; tu evaluación es humana interna (no independiente).</aside>

      <section class="form-card">
        <h2>Pregunta y contexto</h2>
        <p class="q">{{ dossier.item }}</p><p class="ctx">{{ dossier.context }}</p>
        <details><summary>Manual de codificación ({{ d.manualVersion }})</summary><pre>{{ d.manualText }}</pre></details>
      </section>

      <section class="form-card">
        <h2>Discrepancias detectadas</h2>
        <ul><li v-for="(x, i) in dossier.discrepancies" :key="i" :class="{ bad: /SIGNO|NO aparece/.test(x) }">{{ x }}</li><li v-if="!dossier.discrepancies.length">—</li></ul>
        <p class="hint">Comprobación de recuperación: cita registrada {{ rc.registeredQuoteFoundInRetrieved === null ? 'n/a' : rc.registeredQuoteFoundInRetrieved ? 'SÍ aparece' : 'NO aparece' }} en los pasajes recuperados; páginas registradas {{ rc.registeredPages.join(', ') || '—' }}; páginas recuperadas {{ rc.retrievedPages.join(', ') }}.</p>
      </section>

      <section class="form-card">
        <h2>Evaluaciones</h2>
        <table class="t">
          <thead><tr><th>Quién</th><th>Clase</th><th>Int.</th><th>Cita / evidencia</th><th>Justificación</th></tr></thead>
          <tbody>
            <tr class="me"><td><strong>Tú</strong> (humano interno)</td><td>{{ dossier.mine.insufficientContext && !dossier.mine.documentClass ? 'contexto insuficiente' : dossier.mine.documentClass }}</td><td>{{ dossier.mine.intensity ?? '—' }}</td>
              <td><div v-for="(e, i) in dossier.mine.evidence" :key="i">pág. {{ e.page }}: «{{ e.text }}»</div></td><td>{{ dossier.mine.rationale }}</td></tr>
            <tr class="ref"><td><strong>Referencia provisional</strong></td>
              <td>{{ dossier.reference.present ? dossier.reference.stanceStatus : 'sin posición' }}</td><td>{{ dossier.reference.present ? dossier.reference.value : '—' }}</td>
              <td><div v-for="(e, i) in dossier.reference.evidence ?? []" :key="i">pág. {{ e.page }}: «{{ e.text }}»<button type="button" class="btn-link" @click="addEvidence(e.page, e.text, 'cita registrada')"> + evidencia</button></div>
                <div v-if="dossier.reference.claimText">Afirmación: «{{ dossier.reference.claimText }}» (pág. {{ dossier.reference.claimPage }})</div></td>
              <td>{{ dossier.reference.conditions ? 'Condiciones: ' + dossier.reference.conditions : '' }}</td></tr>
            <tr v-for="a in dossier.ai" :key="a.evaluator" :class="{ muted: !a.documentClass }"><td>{{ a.evaluator }}<small v-if="!a.complete"> (parcial)</small></td>
              <td>{{ a.documentClass ?? '—' }}</td><td>{{ a.intensity ?? '—' }}</td>
              <td><span v-if="a.quote">pág. {{ a.page }}: «{{ a.quote }}»<button type="button" class="btn-link" @click="addEvidence(a.page, a.quote, a.evaluator)"> + evidencia</button></span></td><td>{{ a.rationale }}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="form-card">
        <h2>Programa original <a :href="`${dossier.pdf.url}#page=${firstPage}`" target="_blank" rel="noopener" class="btn-secondary small">Abrir PDF ({{ dossier.pdf.pages }} págs.)</a></h2>
        <details v-for="p in dossier.docPages" :key="p.page" :open="p.why.includes('cita registrada') || p.why.includes('evidencia que seleccionaste')">
          <summary>Pág. {{ p.page }} — {{ p.why.join('; ') }} <a :href="`${dossier.pdf.url}#page=${p.page}`" target="_blank" rel="noopener">abrir en el PDF</a></summary>
          <pre>{{ p.text }}</pre>
        </details>
        <details><summary>Pasajes recuperados que vieron los evaluadores ({{ dossier.retrievedPassages.length }})</summary>
          <ol><li v-for="(p, i) in dossier.retrievedPassages" :key="i"><strong>pág. {{ p.page }}</strong> {{ p.text }}</li></ol></details>
      </section>

      <section class="form-card">
        <h2>Tu adjudicación <small v-if="current">(vigente: revisión {{ current.revision }})</small></h2>
        <fieldset class="choices inline">
          <legend>Clasificación documental (sin valor preseleccionado)</legend>
          <label v-for="c in CLASSES" :key="c.v" class="choice small" :class="{ selected: form.documentClass === c.v }"><input type="radio" name="dc" :checked="form.documentClass === c.v" @change="setClass(c.v)" /><span>{{ c.l }}</span></label>
          <label class="choice small" :class="{ selected: form.unresolved }"><input type="radio" name="dc" :checked="form.unresolved" @change="setClass(null)" /><span>Sin resolver</span></label>
        </fieldset>
        <fieldset v-if="form.documentClass === 'supports' || form.documentClass === 'opposes'" class="choices inline">
          <legend>Intensidad</legend>
          <label v-for="o in intensityOptions" :key="o" class="choice small" :class="{ selected: form.intensity === o }"><input type="radio" name="in" :checked="form.intensity === o" @change="form.intensity = o" /><span>{{ o > 0 ? '+' : '' }}{{ o }}</span></label>
        </fieldset>
        <fieldset class="choices">
          <legend>Causa(s) de la discrepancia (una o varias)</legend>
          <label v-for="c in CAUSES" :key="c.v" class="pick"><input v-model="form.causes" type="checkbox" :value="c.v" /> {{ c.l }}</label>
          <input v-if="form.causes.includes('other')" v-model="form.otherCauseText" type="text" maxlength="300" placeholder="Describe la otra causa" aria-label="Otra causa" />
        </fieldset>
        <div class="form-field"><label for="act">Propuesta sobre el banco (informativa; NO se aplica)</label>
          <select id="act" v-model="form.proposedAction"><option :value="null">—</option>
            <option v-for="a in ACTIONS" :key="a.v" :value="a.v">{{ a.l }}</option></select></div>
        <div class="form-field"><label for="why">Justificación</label><textarea id="why" v-model="form.rationale" rows="4" maxlength="6000" /></div>
        <div class="form-field"><label>Evidencia verificada</label>
          <div v-for="(e, i) in form.evidence" :key="i" class="ev"><span>pág. {{ e.page ?? '—' }} · {{ e.source }}: «{{ e.text.slice(0, 160) }}{{ e.text.length > 160 ? '…' : '' }}»</span><button type="button" class="btn-link" @click="form.evidence.splice(i, 1)">quitar</button></div>
          <div class="ev-add"><input v-model.number="newEv.page" type="number" min="1" placeholder="pág." aria-label="Página" /><input v-model="newEv.text" type="text" placeholder="Cita literal del programa" aria-label="Cita" />
            <button type="button" class="btn-secondary small" :disabled="!newEv.text.trim()" @click="addEvidence(newEv.page, newEv.text, 'programa original'); newEv.text = ''; newEv.page = null">Añadir</button></div></div>
        <p v-if="msg" :class="msgOk ? 'ok' : 'error'" role="status">{{ msg }}</p>
        <div class="form-actions"><button type="button" class="btn-primary" :disabled="!!problems.length || saving" @click="save">Registrar adjudicación (nueva revisión)</button>
          <span v-if="problems.length" class="hint">Falta: {{ problems.join('; ') }}</span></div>
      </section>

      <section v-if="d.history.length" class="form-card"><h2>Historial (solo añadir)</h2>
        <ul><li v-for="h in d.history" :key="h.id">Rev. {{ h.revision }} · {{ new Date(h.createdAt).toLocaleString() }} · {{ h.documentClass ?? 'sin resolver' }} {{ h.intensity ?? '' }} · causas: {{ h.causes.join(', ') }} · {{ h.rationale }}</li></ul></section>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })
const route = useRoute(); const cellId = route.params.cellId as string
const CLASSES = [{ v: 'supports', l: 'Apoya' }, { v: 'opposes', l: 'Se opone' }, { v: 'explicit_neutral', l: 'Neutral explícita' }, { v: 'not_mentioned', l: 'No mencionado' }, { v: 'ambiguous', l: 'Ambigua' }]
const CAUSES = [
  { v: 'retrieval_error', l: 'Error de recuperación documental' }, { v: 'interpretation_error', l: 'Error de interpretación' }, { v: 'intensity_error', l: 'Error de intensidad' },
  { v: 'insufficient_evidence', l: 'Evidencia insuficiente' }, { v: 'contradictory_evidence', l: 'Evidencia contradictoria' }, { v: 'ambiguous_question', l: 'Pregunta ambigua o defectuosa' },
  { v: 'manual_insufficient', l: 'Manual de codificación insuficiente' }, { v: 'omitted_position', l: 'Posición omitida' }, { v: 'unsupported_registered_position', l: 'Posición registrada sin respaldo suficiente' },
  { v: 'reasonable_disagreement', l: 'Desacuerdo razonable entre evaluadores' }, { v: 'other', l: 'Otra causa justificada' }]
const ACTIONS = [{ v: 'confirm_registered', l: 'Confirmar la posición registrada' }, { v: 'correct_registered', l: 'Corregir la posición registrada' }, { v: 'remove_registered', l: 'Retirar la posición registrada (sin respaldo)' }, { v: 'add_position', l: 'Añadir una posición omitida' }, { v: 'no_change', l: 'Sin cambios' }]

const { data: d, error, refresh } = await useFetch<any>(`/api/admin/adjudicacion/${cellId}`)
const { data: queue } = await useFetch<{ items: { cellId: string }[] }>('/api/admin/adjudicacion')
const dossier = computed(() => d.value.dossier); const rc = computed(() => dossier.value.retrievalCheck)
const current = computed(() => d.value?.history?.[0] ?? null)
const idx = computed(() => queue.value?.items.findIndex((i) => i.cellId === cellId) ?? -1)
const prevId = computed(() => (idx.value > 0 ? queue.value!.items[idx.value - 1].cellId : null)); const nextId = computed(() => (idx.value >= 0 && idx.value < (queue.value?.items.length ?? 0) - 1 ? queue.value!.items[idx.value + 1].cellId : null))
const firstPage = computed(() => dossier.value.docPages?.find((p: any) => p.why.includes('cita registrada'))?.page ?? dossier.value.docPages?.[0]?.page ?? 1)

// Formulario SIN valores preseleccionados (partes vacías aunque ya haya una adjudicación vigente: cada revisión es una decisión nueva consciente)
const form = reactive<{ documentClass: string | null; unresolved: boolean; intensity: number | null; causes: string[]; otherCauseText: string; proposedAction: string | null; rationale: string; evidence: { page: number | null; text: string; source: string }[] }>(
  { documentClass: null, unresolved: false, intensity: null, causes: [], otherCauseText: '', proposedAction: null, rationale: '', evidence: [] })
const newEv = reactive<{ page: number | null; text: string }>({ page: null, text: '' })
const saving = ref(false); const msg = ref(''); const msgOk = ref(false)
const intensityOptions = computed(() => (form.documentClass === 'opposes' ? [-2, -1] : [1, 2]))
function setClass(v: string | null) { form.documentClass = v; form.unresolved = v === null; form.intensity = v === 'explicit_neutral' ? 0 : null }
function addEvidence(page: number | null, text: string, source: string) { if (text?.trim()) form.evidence.push({ page: page ?? null, text: text.trim(), source }) }
const problems = computed(() => {
  const p: string[] = []
  if (!form.documentClass && !form.unresolved) p.push('clasificación (o «Sin resolver»)')
  if ((form.documentClass === 'supports' || form.documentClass === 'opposes') && form.intensity == null) p.push('intensidad')
  if (!form.causes.length) p.push('al menos una causa')
  if (form.causes.includes('other') && !form.otherCauseText.trim()) p.push('describir la otra causa')
  if (!form.rationale.trim()) p.push('justificación')
  return p
})
async function save() {
  saving.value = true; msg.value = ''
  try {
    const r = await $fetch<{ revision: number }>(`/api/admin/adjudicacion/${cellId}`, { method: 'POST', body: { ...form, expectedRevision: current.value?.revision ?? 0 } })
    msg.value = `Adjudicación registrada (revisión ${r.revision}).`; msgOk.value = true
    Object.assign(form, { documentClass: null, unresolved: false, intensity: null, causes: [], otherCauseText: '', proposedAction: null, rationale: '', evidence: [] })
    await refresh()
  } catch (e: any) { msg.value = e?.data?.statusMessage || e?.statusMessage || 'No se pudo registrar'; msgOk.value = false } finally { saving.value = false }
}
</script>

<style scoped>
.notice { margin: 0 0 1rem; padding: 0.75rem 1rem; border: 1px solid var(--line-strong); border-left: 4px solid var(--accent); border-radius: var(--radius); background: var(--sunken); font-size: 0.9rem; }
.nav { display: flex; gap: 0.5rem; } h1 small { font-size: 0.9rem; color: var(--ink-3); font-weight: 500; }
.q { font-size: 1.125rem; font-weight: 650; margin: 0 0 0.5rem; } .ctx { color: var(--ink-2); }
pre { white-space: pre-wrap; font-size: 0.8125rem; background: var(--sunken); padding: 0.75rem; border-radius: var(--radius); max-height: 22rem; overflow: auto; }
.t { width: 100%; border-collapse: collapse; font-size: 0.875rem; } .t th, .t td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--line-strong); text-align: left; vertical-align: top; }
.t tr.me td { background: var(--accent-tint); } .t tr.ref td { background: #fff6db; } .t tr.muted { opacity: 0.55; }
li.bad { color: #8a1c1c; font-weight: 600; }
.choices { margin: 0 0 1rem; padding: 0; border: 0; display: grid; gap: 0.375rem; } .choices.inline { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; } .choices legend { font-weight: 600; margin-bottom: 0.375rem; padding: 0; } .choices.inline legend { flex-basis: 100%; }
.choice { padding: 0.375rem 0.875rem; border: 1px solid var(--line-strong); border-radius: var(--radius); cursor: pointer; display: inline-flex; gap: 0.5rem; align-items: center; } .choice.selected { border-color: var(--accent); background: var(--accent-tint); }
.pick { display: inline-flex; gap: 0.5rem; align-items: center; font-size: 0.9rem; }
.form-field { display: grid; gap: 0.25rem; margin-bottom: 1rem; } .form-field textarea, .form-field select { width: 100%; box-sizing: border-box; }
.ev { display: flex; gap: 0.75rem; font-size: 0.85rem; align-items: baseline; } .ev-add { display: flex; gap: 0.5rem; } .ev-add input[type=text] { flex: 1; } .ev-add input[type=number] { width: 5rem; }
.btn-link { background: none; border: 0; color: var(--accent); cursor: pointer; padding: 0; } .small { padding: 0.125rem 0.625rem; font-size: 0.8125rem; } .hint { color: var(--ink-3); font-size: 0.8125rem; } .ok { color: #1f6b2a; font-weight: 600; }
details { margin: 0.375rem 0; } summary { cursor: pointer; }
</style>
