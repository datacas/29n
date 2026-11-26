<template>
  <div class="admin-page eval">
    <div class="page-header">
      <div>
        <h1>{{ campaignName }}</h1>
        <p class="subtitle">
          Evaluación ciega: ves solo la pregunta, el contexto y los pasajes. Humano interno (no referencia independiente).
          <NuxtLink to="/admin/evaluacion">← Campañas</NuxtLink>
        </p>
      </div>
      <div class="progress" role="status">
        <strong>{{ counts.finalized }}/{{ cells.length }}</strong> finalizadas · {{ counts.draft }} borradores
        <div class="bar-container" aria-hidden="true"><div class="bar" :style="{ width: pct + '%' }" /></div>
      </div>
    </div>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <template v-else-if="cells.length">
      <!-- Filtro y navegación -->
      <div class="item-nav">
        <label class="inline">Ver
          <select v-model="filter" aria-label="Filtrar celdas">
            <option value="all">Todas ({{ cells.length }})</option>
            <option value="pending">Pendientes ({{ counts.pending }})</option>
            <option value="draft">Con borrador ({{ counts.draft }})</option>
            <option value="finalized">Finalizadas ({{ counts.finalized }})</option>
            <option value="context">Contexto pedido ({{ counts.context }})</option>
          </select>
        </label>
        <button type="button" class="btn-secondary" :disabled="!hasPrev" @click="step(-1)">← Anterior</button>
        <span>Celda {{ position + 1 }} de {{ visible.length }}</span>
        <button type="button" class="btn-secondary" :disabled="!hasNext" @click="step(1)">Siguiente →</button>
        <button type="button" class="btn-secondary" :disabled="!counts.pending && !counts.draft" @click="goPending">Siguiente pendiente</button>
        <button type="button" class="btn-secondary" @click="reviewing = !reviewing">{{ reviewing ? 'Volver a la celda' : 'Revisar antes de finalizar' }}</button>
      </div>

      <!-- Revisión global -->
      <section v-if="reviewing" class="form-card" aria-label="Revisión de la campaña">
        <h2>Revisión</h2>
        <p class="hint">Tus propias decisiones. Las evaluaciones finalizadas ya no se pueden cambiar; revisa las demás antes de finalizarlas.</p>
        <table class="review-table">
          <thead><tr><th>#</th><th>Celda</th><th>Estado</th><th>Clase</th><th>Int.</th><th>Evid.</th><th>Justif.</th><th /></tr></thead>
          <tbody>
            <tr v-for="c in cells" :key="c.cellId" :class="{ incomplete: isIncomplete(c) }">
              <td>{{ c.ord }}</td><td>{{ c.blindLabel }}</td>
              <td>{{ STATUS[c.status] }}<span v-if="c.contextRequestOpen"> · contexto pedido</span></td>
              <td>{{ c.insufficientContext && !c.documentClass ? 'contexto insuficiente' : (c.documentClass ? CLASS_LABEL[c.documentClass] : '—') }}</td>
              <td>{{ c.intensity ?? '—' }}</td><td>{{ c.evidenceCount }}</td><td>{{ c.hasRationale ? 'sí' : '—' }}</td>
              <td><button type="button" class="btn-secondary small" @click="open(c.cellId)">Abrir</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <p v-else-if="!cell" class="hint">No hay celdas en este filtro.</p>

      <!-- Celda -->
      <article v-else class="form-card item" :class="{ locked }">
        <p class="meta">{{ cell.blindLabel }} · celda {{ cell.ord }} · pasajes versión {{ cell.version }}
          <span v-if="locked" class="badge done">Finalizada (no editable)</span></p>
        <h2 class="proposition">{{ cell.item }}</h2>
        <p class="context">{{ cell.context }}</p>

        <p v-if="staleDraft" class="warn" role="alert">
          El contexto se ha ampliado (versión {{ cell.version }}) desde que guardaste este borrador. Revisa los pasajes nuevos y tu decisión; al guardar se registrará la versión actual.
        </p>

        <details class="manual"><summary>Manual de codificación ({{ manualVersion }})</summary><pre>{{ manualText }}</pre></details>

        <h3>Pasajes del programa ({{ cell.passages.length }})</h3>
        <ol class="claims">
          <li v-for="(p, i) in cell.passages" :key="i" :class="{ picked: form.selectedEvidence.includes(i) }">
            <label class="pick">
              <input type="checkbox" :checked="form.selectedEvidence.includes(i)" :disabled="locked" @change="toggleEvidence(i)" />
              <span>Usar como evidencia</span>
            </label>
            <blockquote>{{ p.text }}</blockquote>
            <p class="claim-meta"><span>[{{ i + 1 }}]</span><span v-if="p.page">pág. {{ p.page }}</span></p>
          </li>
        </ol>

        <fieldset class="choices" :disabled="locked">
          <legend>Clase documental (sin valor preseleccionado)</legend>
          <label v-for="(o, i) in CLASSES" :key="o.value" class="choice" :class="{ selected: form.documentClass === o.value }">
            <input type="radio" name="cls" :value="o.value" :checked="form.documentClass === o.value" @change="setClass(o.value)" />
            <span class="choice-text"><strong>{{ o.label }}</strong> <kbd>{{ i + 1 }}</kbd><small>{{ o.help }}</small></span>
          </label>
          <button v-if="form.documentClass" type="button" class="btn-link" @click="setClass(null)">Quitar clase</button>
        </fieldset>

        <fieldset v-if="form.documentClass === 'supports' || form.documentClass === 'opposes'" class="choices inline" :disabled="locked">
          <legend>Intensidad</legend>
          <label v-for="o in intensityOptions" :key="o.value" class="choice small" :class="{ selected: form.intensity === o.value }">
            <input type="radio" name="int" :value="o.value" :checked="form.intensity === o.value" @change="setIntensity(o.value)" />
            <span>{{ o.label }} ({{ o.value > 0 ? '+' : '' }}{{ o.value }}) <kbd>{{ o.key }}</kbd></span>
          </label>
        </fieldset>
        <p v-else-if="form.documentClass === 'explicit_neutral'" class="hint">Intensidad: 0 (automática).</p>

        <div class="form-field">
          <label for="rationale">Justificación</label>
          <textarea id="rationale" v-model="form.rationale" rows="3" maxlength="4000" :disabled="locked" @input="touch" />
        </div>

        <div class="context-box" :class="{ on: form.insufficientContext }">
          <label class="pick"><input v-model="form.insufficientContext" type="checkbox" :disabled="locked" @change="touch" />
            <span><strong>Contexto insuficiente</strong> <kbd>I</kbd> — necesito más evidencia para decidir (no hace falta emitir clase).</span></label>
          <template v-if="!locked">
            <div v-if="cell.contextRequest?.status !== 'open'" class="form-actions">
              <input v-model="contextNote" type="text" maxlength="500" placeholder="Qué necesitas (opcional)" aria-label="Nota de contexto" />
              <button type="button" class="btn-secondary" :disabled="busy" @click="requestMoreContext">Pedir más contexto</button>
            </div>
            <div v-else class="form-actions">
              <span class="hint">Petición abierta: «{{ cell.contextRequest.note || 'sin nota' }}».</span>
              <button type="button" class="btn-secondary" :disabled="busy" @click="expandContext">Ampliar con páginas contiguas</button>
            </div>
            <p v-if="cell.contextRequest?.status === 'resolved'" class="hint">Última petición atendida en la versión {{ cell.contextRequest.resolvedVersion }}.</p>
          </template>
        </div>

        <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
        <div class="statusbar" role="status" aria-live="polite" :class="saveState">
          <span v-if="saveState === 'saving'">Guardando…</span>
          <span v-else-if="saveState === 'saved'">✔ Guardado {{ savedAt }}</span>
          <span v-else-if="saveState === 'dirty'">● Cambios sin guardar…</span>
          <span v-else-if="saveState === 'error'">✖ No se pudo guardar: {{ saveError }} <button type="button" class="btn-secondary small" @click="flush()">Reintentar</button></span>
          <span v-else-if="saveState === 'conflict'">✖ Conflicto de edición: {{ saveError }} <button type="button" class="btn-secondary small" @click="reloadCell()">Recargar celda</button></span>
          <span v-else-if="locked">Evaluación finalizada.</span>
          <span v-else>Sin cambios.</span>
        </div>

        <div class="form-actions" v-if="!locked">
          <button type="button" class="btn-primary" :disabled="!canFinalize || busy || saveState === 'error' || saveState === 'conflict'" @click="finalize">Finalizar esta evaluación (irreversible)</button>
          <span v-if="problems.length" class="hint">Falta: {{ problems.join('; ') }}</span>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

interface CellRow { cellId: string; ord: number; blindLabel: string; status: 'pending' | 'draft' | 'finalized'; documentClass: string | null; intensity: number | null; hasRationale: boolean; evidenceCount: number; insufficientContext: boolean; contextRequestOpen: boolean; campaignStatus: string }
interface CellDto {
  cellId: string; ord: number; blindLabel: string; campaignStatus: string; manualVersion: string; manualText: string; version: number; item: string; context: string
  passages: { page: number | null; text: string }[]
  draft: { version: number; cellVersion: number; documentClass: string | null; intensity: number | null; selectedEvidence: number[]; rationale: string; insufficientContext: boolean; finalized: boolean } | null
  contextRequest: { note: string; status: string; requestedAt: string; resolvedVersion: number | null } | null
}

const CLASSES = [
  { value: 'supports', label: 'Apoya', help: 'El programa apoya la medida de la pregunta.' },
  { value: 'opposes', label: 'Se opone', help: 'El programa rechaza la medida o propone lo contrario.' },
  { value: 'explicit_neutral', label: 'Neutral explícita', help: 'Declara de forma explícita una posición intermedia o no tomar partido. Es raro.' },
  { value: 'not_mentioned', label: 'No mencionado', help: 'En los pasajes dados no hay nada que responda. El silencio no es neutralidad ni oposición.' },
  { value: 'ambiguous', label: 'Ambigua', help: 'Señales contradictorias o una condición cambia la lectura, y no puedes decidir.' }
]
const CLASS_LABEL: Record<string, string> = Object.fromEntries(CLASSES.map((c) => [c.value, c.label]))
const STATUS: Record<string, string> = { pending: 'Pendiente', draft: 'Borrador', finalized: 'Finalizada' }

const route = useRoute()
const campaignId = route.params.campaignId as string
const campaignName = ref('Campaña de evaluación')
const loadError = ref('')
const cells = ref<CellRow[]>([])
const filter = ref<'all' | 'pending' | 'draft' | 'finalized' | 'context'>('all')
const reviewing = ref(false)
const cell = ref<CellDto | null>(null)
const manualVersion = computed(() => cell.value?.manualVersion ?? '')
const manualText = computed(() => cell.value?.manualText ?? '')

const form = reactive<{ documentClass: string | null; intensity: number | null; selectedEvidence: number[]; rationale: string; insufficientContext: boolean }>({
  documentClass: null, intensity: null, selectedEvidence: [], rationale: '', insufficientContext: false
})
const draftVersion = ref(0)
const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'>('idle')
const saveError = ref('')
const savedAt = ref('')
const actionError = ref('')
const contextNote = ref('')
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let retry: ReturnType<typeof setTimeout> | null = null
let retries = 0
let inflight: Promise<void> | null = null

const locked = computed(() => !!cell.value?.draft?.finalized || cell.value?.campaignStatus !== 'open')
const staleDraft = computed(() => !!cell.value?.draft && cell.value.draft.cellVersion < cell.value.version && !locked.value)
const counts = computed(() => ({
  pending: cells.value.filter((c) => c.status === 'pending').length,
  draft: cells.value.filter((c) => c.status === 'draft').length,
  finalized: cells.value.filter((c) => c.status === 'finalized').length,
  context: cells.value.filter((c) => c.contextRequestOpen).length
}))
const pct = computed(() => (cells.value.length ? Math.round((counts.value.finalized / cells.value.length) * 100) : 0))
const visible = computed(() => cells.value.filter((c) => filter.value === 'all' || (filter.value === 'context' ? c.contextRequestOpen : c.status === filter.value)))
const position = computed(() => Math.max(0, visible.value.findIndex((c) => c.cellId === cell.value?.cellId)))
const hasPrev = computed(() => position.value > 0)
const hasNext = computed(() => position.value < visible.value.length - 1)

const intensityOptions = computed(() => form.documentClass === 'opposes'
  ? [{ value: -2, label: 'Fuerte', key: 'F' }, { value: -1, label: 'Moderada', key: 'M' }]
  : [{ value: 2, label: 'Fuerte', key: 'F' }, { value: 1, label: 'Moderada', key: 'M' }])

const problems = computed(() => {
  const p: string[] = []
  const cls = form.documentClass
  if (!cls && !form.insufficientContext) p.push('clase documental (o marcar contexto insuficiente)')
  if (cls === 'supports' || cls === 'opposes') { if (form.intensity == null) p.push('intensidad') }
  if (cls && ['supports', 'opposes', 'explicit_neutral'].includes(cls) && !form.selectedEvidence.length) p.push('al menos una evidencia')
  if (cls && cls !== 'not_mentioned' && !form.rationale.trim()) p.push('justificación')
  return p
})
const canFinalize = computed(() => !locked.value && problems.value.length === 0)
const isIncomplete = (c: CellRow) => c.status !== 'finalized' && (!c.documentClass && !c.insufficientContext
  || (!!c.documentClass && c.documentClass !== 'not_mentioned' && !c.hasRationale)
  || ((c.documentClass === 'supports' || c.documentClass === 'opposes') && c.intensity == null))

const hasContent = () => !!(form.documentClass || form.insufficientContext || form.rationale.trim() || form.selectedEvidence.length || form.intensity != null)
const errMsg = (e: any) => e?.data?.statusMessage || e?.statusMessage || e?.message || 'error de red'

function applyDraft(d: CellDto['draft']) {
  form.documentClass = d?.documentClass ?? null
  form.intensity = d?.intensity ?? null
  form.selectedEvidence = [...(d?.selectedEvidence ?? [])]
  form.rationale = d?.rationale ?? ''
  form.insufficientContext = d?.insufficientContext ?? false
  draftVersion.value = d?.version ?? 0
  saveState.value = d ? 'saved' : 'idle'
  if (d) savedAt.value = new Date().toLocaleTimeString()
}

async function loadList() {
  const r = await $fetch<{ cells: CellRow[] }>(`/api/admin/evaluacion/${campaignId}/cells`)
  cells.value = r.cells
}
async function loadCell(id: string) {
  const c = await $fetch<CellDto>(`/api/admin/evaluacion/${campaignId}/cells/${id}`)
  cell.value = c
  actionError.value = ''; saveError.value = ''; retries = 0
  applyDraft(c.draft)
}

async function open(id: string) {
  await flush()
  if (saveState.value === 'error' || saveState.value === 'conflict') return   // no abandonar cambios sin guardar
  reviewing.value = false
  await loadCell(id)
}
async function step(delta: number) {
  const next = visible.value[position.value + delta]
  if (next) await open(next.cellId)
}
async function goPending() {
  const n = cells.value.length; const from = cells.value.findIndex((c) => c.cellId === cell.value?.cellId)
  for (let k = 1; k <= n; k++) { const c = cells.value[(from + k) % n]; if (c.status !== 'finalized') return open(c.cellId) }
}

function touch() {
  if (locked.value) return
  saveState.value = 'dirty'
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void flush() }, 800)
}

/** Guarda lo pendiente; las llamadas se serializan para no pisar la versión del borrador. */
async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null }
  if (inflight) { await inflight }
  if (saveState.value !== 'dirty' && saveState.value !== 'error') return
  if (!cell.value || locked.value) return
  if (!hasContent() && draftVersion.value === 0) { saveState.value = 'idle'; return }
  inflight = (async () => {
    saveState.value = 'saving'
    try {
      const r = await $fetch<{ version: number }>(`/api/admin/evaluacion/${campaignId}/cells/${cell.value!.cellId}/draft`, {
        method: 'PUT',
        body: { expectedVersion: draftVersion.value, cellVersion: cell.value!.version, documentClass: form.documentClass, intensity: form.intensity, selectedEvidence: form.selectedEvidence, rationale: form.rationale, insufficientContext: form.insufficientContext }
      })
      draftVersion.value = r.version
      if (cell.value.draft) cell.value.draft.cellVersion = cell.value.version
      retries = 0; savedAt.value = new Date().toLocaleTimeString(); saveState.value = 'saved'
      void loadList().catch(() => {})
    } catch (e: any) {
      saveError.value = errMsg(e)
      if (e?.statusCode === 409 || e?.status === 409) saveState.value = 'conflict'
      else {
        saveState.value = 'error'
        // Reintento automático con espera creciente (red caída, BD reiniciándose…); sigue visible el error hasta guardar.
        retries += 1
        if (retry) clearTimeout(retry)
        retry = setTimeout(() => { void flush() }, Math.min(30000, 2000 * 2 ** Math.min(retries, 4)))
      }
    } finally { inflight = null }
  })()
  await inflight
}

async function reloadCell() { if (cell.value) { saveState.value = 'idle'; await loadCell(cell.value.cellId); await loadList() } }

function setClass(v: string | null) {
  form.documentClass = v
  if (v === 'explicit_neutral') form.intensity = 0
  else if (v === 'supports' && !(form.intensity === 1 || form.intensity === 2)) form.intensity = null
  else if (v === 'opposes' && !(form.intensity === -1 || form.intensity === -2)) form.intensity = null
  else if (v === 'not_mentioned' || v === 'ambiguous' || v === null) form.intensity = null
  touch()
}
function setIntensity(v: number) { form.intensity = v; touch() }
function toggleEvidence(i: number) {
  const k = form.selectedEvidence.indexOf(i)
  if (k >= 0) form.selectedEvidence.splice(k, 1); else form.selectedEvidence.push(i)
  form.selectedEvidence.sort((a, b) => a - b); touch()
}

async function requestMoreContext() {
  if (!cell.value) return
  busy.value = true; actionError.value = ''
  try {
    await $fetch(`/api/admin/evaluacion/${campaignId}/cells/${cell.value.cellId}/context`, { method: 'POST', body: { action: 'request', note: contextNote.value } })
    contextNote.value = ''
    await flush(); await loadCell(cell.value.cellId); await loadList()
  } catch (e) { actionError.value = errMsg(e) } finally { busy.value = false }
}
async function expandContext() {
  if (!cell.value) return
  busy.value = true; actionError.value = ''
  try {
    await flush()
    if (saveState.value === 'error' || saveState.value === 'conflict') return
    const r = await $fetch<{ version: number; added: number }>(`/api/admin/evaluacion/${campaignId}/cells/${cell.value.cellId}/context`, { method: 'POST', body: { action: 'expand' } })
    await loadCell(cell.value.cellId); await loadList()
    actionError.value = r.added ? '' : 'No había páginas contiguas nuevas que añadir.'
  } catch (e) { actionError.value = errMsg(e) } finally { busy.value = false }
}

async function finalize() {
  if (!cell.value || !canFinalize.value) return
  await flush()
  if (saveState.value === 'error' || saveState.value === 'conflict') return
  if (!window.confirm('Finalizar es IRREVERSIBLE: la evaluación se registrará y no podrá editarse. ¿Continuar?')) return
  busy.value = true; actionError.value = ''
  try {
    await $fetch(`/api/admin/evaluacion/${campaignId}/cells/${cell.value.cellId}/finalize`, { method: 'POST', body: { expectedVersion: draftVersion.value, cellVersion: cell.value.version } })
    await loadList()
    const next = cells.value.find((c) => c.status !== 'finalized')
    await loadCell((next ?? cells.value.find((c) => c.cellId === cell.value!.cellId)!).cellId)
  } catch (e) { actionError.value = errMsg(e); await loadList().catch(() => {}) } finally { busy.value = false }
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  const typing = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'search'].includes((t as HTMLInputElement).type)))
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void finalize(); return }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || locked.value || reviewing.value || !cell.value) return
  const n = Number(e.key)
  if (n >= 1 && n <= CLASSES.length) { setClass(CLASSES[n - 1].value); return }
  const k = e.key.toLowerCase()
  if (k === 'f' && (form.documentClass === 'supports' || form.documentClass === 'opposes')) setIntensity(form.documentClass === 'opposes' ? -2 : 2)
  else if (k === 'm' && (form.documentClass === 'supports' || form.documentClass === 'opposes')) setIntensity(form.documentClass === 'opposes' ? -1 : 1)
  else if (k === 'i') { form.insufficientContext = !form.insufficientContext; touch() }
  else if (e.key === 'ArrowRight') { void step(1) }
  else if (e.key === 'ArrowLeft') { void step(-1) }
}
function beforeUnload(e: BeforeUnloadEvent) { if (saveState.value === 'dirty' || saveState.value === 'saving' || saveState.value === 'error') { e.preventDefault(); e.returnValue = '' } }

onMounted(async () => {
  window.addEventListener('keydown', onKey); window.addEventListener('beforeunload', beforeUnload)
  try {
    await loadList()
    const list = await $fetch<{ campaigns: { id: string; name: string }[] }>('/api/admin/evaluacion')
    campaignName.value = list.campaigns.find((c) => c.id === campaignId)?.name ?? campaignName.value
    const first = cells.value.find((c) => c.status !== 'finalized') ?? cells.value[0]
    if (first) await loadCell(first.cellId)
  } catch (e) { loadError.value = errMsg(e) }
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', beforeUnload); if (timer) clearTimeout(timer); if (retry) clearTimeout(retry) })
</script>

<style scoped>
.item-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: var(--ink-3); font-size: 0.875rem; }
.inline { display: inline-flex; gap: 0.5rem; align-items: center; }
.meta { margin: 0 0 0.25rem; color: var(--ink-3); font-size: 0.8125rem; font-weight: 600; }
.proposition { margin: 0 0 0.75rem; font-size: 1.25rem; line-height: 1.35; font-weight: 650; text-wrap: balance; }
.context { margin: 0 0 1rem; color: var(--ink-2); line-height: 1.5; }
.manual { margin: 0 0 1rem; } .manual pre { white-space: pre-wrap; font-size: 0.8125rem; background: var(--sunken); padding: 0.75rem; border-radius: var(--radius); }
.claims { margin: 0 0 1.5rem; padding: 0; list-style: none; display: grid; gap: 0.75rem; }
.claims li { padding: 0.5rem; border: 1px solid transparent; border-radius: var(--radius); }
.claims li.picked { border-color: var(--accent); background: var(--accent-tint); }
.claims blockquote { margin: 0.25rem 0 0; padding: 0.75rem 1rem; background: var(--sunken); border-radius: var(--radius); line-height: 1.55; white-space: pre-wrap; }
.claim-meta { margin: 0.375rem 0 0; display: flex; gap: 1rem; font-size: 0.8125rem; color: var(--ink-3); }
.pick { display: inline-flex; gap: 0.5rem; align-items: center; font-size: 0.875rem; cursor: pointer; }
.choices { margin: 0 0 1.25rem; padding: 0; border: 0; display: grid; gap: 0.5rem; }
.choices legend { padding: 0; margin-bottom: 0.5rem; font-weight: 600; }
.choices.inline { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; } .choices.inline legend { flex-basis: 100%; }
.choice { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 1rem; border: 1px solid var(--line-strong); border-radius: var(--radius); cursor: pointer; }
.choice.selected { border-color: var(--accent); background: var(--accent-tint); }
.choice.small { padding: 0.375rem 0.875rem; align-items: center; }
.choice-text small { display: block; color: var(--ink-3); font-size: 0.8125rem; }
kbd { margin-left: 0.375rem; padding: 0 0.375rem; border: 1px solid var(--line-strong); border-radius: 4px; font-size: 0.75rem; color: var(--ink-3); }
.context-box { margin: 0 0 1rem; padding: 0.75rem 1rem; border: 1px dashed var(--line-strong); border-radius: var(--radius); display: grid; gap: 0.5rem; }
.context-box.on { border-color: var(--accent); }
.form-field { display: grid; margin-bottom: 1rem; } .form-field textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.statusbar { margin: 0.5rem 0 1rem; padding: 0.5rem 0.75rem; border-radius: var(--radius); background: var(--sunken); font-size: 0.875rem; }
.statusbar.saved { color: var(--ink-2); } .statusbar.error, .statusbar.conflict { background: #fde8e8; color: #8a1c1c; font-weight: 600; }
.warn { padding: 0.5rem 0.75rem; border-radius: var(--radius); background: #fff6db; color: #6b4e00; }
.badge.done { margin-left: 0.5rem; padding: 0.125rem 0.5rem; border-radius: 999px; background: var(--sunken); border: 1px solid var(--line-strong); }
.locked { opacity: 0.92; }
.review-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; } .review-table th, .review-table td { padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--line-strong); text-align: left; }
.review-table tr.incomplete td { background: #fff6db; }
.btn-link { background: none; border: 0; color: var(--accent); cursor: pointer; text-align: left; padding: 0; }
.small { padding: 0.125rem 0.625rem; font-size: 0.8125rem; }
.hint { color: var(--ink-3); font-size: 0.8125rem; }
.progress { min-width: 200px; font-size: 0.875rem; color: var(--ink-2); } .progress .bar-container { margin-top: 0.375rem; }
</style>
