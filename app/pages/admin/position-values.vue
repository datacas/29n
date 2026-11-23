<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>Asignar posturas</h1>
        <p class="subtitle">
          Para cada posición aprobada, fija qué postura expresa el partido ante la proposición (−2 a +2).
          La sugerencia de Jev está oculta: úsala solo si la necesitas.
        </p>
      </div>
      <div class="progress" role="status">
        <strong>{{ decidedCount }}/{{ items.length }}</strong> asignadas
        <div class="bar-container" aria-hidden="true"><div class="bar" :style="{ width: pct + '%' }" /></div>
      </div>
    </div>

    <p v-if="error" class="error" role="alert">{{ error.statusMessage || 'No se pudo cargar' }}</p>

    <template v-else-if="current">
      <div class="item-nav">
        <button type="button" class="btn-secondary" :disabled="index === 0" @click="go(index - 1)">← Anterior</button>
        <span>Posición {{ index + 1 }} de {{ items.length }}</span>
        <button type="button" class="btn-secondary" :disabled="index === items.length - 1" @click="go(index + 1)">Siguiente →</button>
        <button type="button" class="btn-secondary" :disabled="!anyPending" @click="goPending">Siguiente sin asignar</button>
      </div>

      <article class="form-card item">
        <p class="meta">{{ current.questionId }} · {{ current.party }}
          <span v-if="current.decided" class="status-badge status-approved">Asignada</span>
        </p>
        <h2 class="proposition">{{ current.question }}</h2>

        <h3>Citas aprobadas ({{ current.claims.length }})</h3>
        <ol class="claims">
          <li v-for="(c, i) in current.claims" :key="i">
            <blockquote>«{{ c.literalText }}»</blockquote>
            <p v-if="c.translation" class="translation"><strong>Traducción:</strong> {{ c.translation }}</p>
            <p class="claim-meta">
              <span v-if="c.page">pág. {{ c.page }}</span>
              <span v-if="c.conditions">Condiciones: {{ c.conditions }}</span>
            </p>
          </li>
        </ol>

        <fieldset class="choices">
          <legend>¿Qué postura expresa el partido ante esta proposición?</legend>
          <label v-for="(o, i) in OPTIONS" :key="o.key" class="choice" :class="{ selected: draft.pick === o.key }">
            <input v-model="draft.pick" type="radio" name="pick" :value="o.key" />
            <span class="choice-text">
              <strong>{{ o.label }}</strong> <kbd v-if="i < 5">{{ i + 1 }}</kbd>
              <small>{{ o.help }}</small>
            </span>
          </label>
        </fieldset>

        <div v-if="isValuePick && draft.pick !== '0'" class="cond">
          <label class="check">
            <input v-model="draft.conditional" type="checkbox" />
            La postura depende de una condición relevante
          </label>
          <div v-if="draft.conditional" class="form-field">
            <label for="cond">Condición (se mostrará al votante)</label>
            <input id="cond" v-model="draft.conditions" type="text" maxlength="500" />
          </div>
        </div>

        <div class="suggestion">
          <label class="check auto"><input v-model="autoSuggest" type="checkbox" @change="onAutoChange" /> Mostrar siempre la sugerencia de Jev</label>
          <button v-if="!showSuggestion" type="button" class="btn-secondary" @click="revealSuggestion">Mostrar sugerencia de Jev</button>
          <p v-else-if="suggestion" class="hint">
            Jev sugiere: <strong>{{ suggestionLabel }}</strong>
            <span v-if="suggestion.confidence !== null">(confianza {{ Math.round(suggestion.confidence * 100) }} %)</span>.
            Es solo una orientación.
          </p>
          <p v-else class="hint">Jev no tiene sugerencia para esta posición.</p>
        </div>

        <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
        <div class="form-actions">
          <button type="button" class="btn-primary" :disabled="!canSave || saving" @click="save">
            {{ saving ? 'Guardando…' : 'Guardar y continuar' }}
          </button>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

interface Claim { literalText: string; translation?: string | null; page: number | null; conditions: string | null }
interface Item {
  positionId: string; questionId: string; question: string; party: string; claims: Claim[]
  decided: boolean; value: number | null; stanceStatus: string | null; conditions: string | null
}

const OPTIONS = [
  { key: '2', label: 'Apoya explícitamente (+2)', help: 'El programa apoya la proposición de forma clara.' },
  { key: '1', label: 'Apoya en parte (+1)', help: 'Apoyo parcial: con matices o alcance limitado.' },
  { key: '0', label: 'Neutralidad explícita (0)', help: 'Solo si el texto declara expresamente no tomar partido. Nunca por falta de información.' },
  { key: '-1', label: 'Se opone en parte (−1)', help: 'Oposición parcial: con matices o alcance limitado.' },
  { key: '-2', label: 'Se opone explícitamente (−2)', help: 'El programa rechaza la proposición de forma clara.' },
  { key: 'ambiguous', label: 'Señales contradictorias', help: 'Las citas se contradicen. Queda excluida del cálculo.' },
  { key: 'conflicting_sources', label: 'Fuentes contradictorias', help: 'Otras fuentes dicen lo contrario. Queda excluida del cálculo.' },
  { key: 'not_comparable', label: 'No comparable', help: 'La pregunta no es comparable en este contexto. Queda excluida del cálculo.' }
]

const { data, error, refresh } = await useFetch<{ items: Item[]; decided: number; total: number }>('/api/admin/position-values')
const items = computed(() => data.value?.items ?? [])
const decidedCount = computed(() => items.value.filter((i) => i.decided).length)
const pct = computed(() => (items.value.length ? Math.round((decidedCount.value / items.value.length) * 100) : 0))
const anyPending = computed(() => items.value.some((i) => !i.decided))

const index = ref(0)
const current = computed(() => items.value[index.value])
const draft = reactive<{ pick: string | null; conditional: boolean; conditions: string }>({ pick: null, conditional: false, conditions: '' })
const saving = ref(false)
const saveError = ref('')
const showSuggestion = ref(false)
const autoSuggest = ref(true) // por defecto visible para ir rápido; se registra si se mostró
const suggestions = ref<Record<string, { choice: string; value: number | null; confidence: number | null }> | null>(null)

const isValuePick = computed(() => ['2', '1', '0', '-1', '-2'].includes(draft.pick ?? ''))
const canSave = computed(() => !!draft.pick && (!draft.conditional || !isValuePick.value || draft.pick === '0' || !!draft.conditions.trim()))
const suggestion = computed(() => (current.value && suggestions.value ? (suggestions.value[current.value.positionId] ?? null) : null))
const LABELS: Record<string, string> = {
  strongly_for: 'apoya explícitamente (+2)', partially_for: 'apoya en parte (+1)', neutral_explicit: 'neutralidad explícita (0)',
  partially_against: 'se opone en parte (−1)', strongly_against: 'se opone explícitamente (−2)', contradictory: 'señales contradictorias'
}
const suggestionLabel = computed(() => (suggestion.value ? (LABELS[suggestion.value.choice] ?? suggestion.value.choice) : ''))

async function revealSuggestion() {
  showSuggestion.value = true
  if (!suggestions.value) {
    try { suggestions.value = await $fetch('/api/admin/position-values/suggestions') } catch { suggestions.value = {} }
  }
}

function onAutoChange() {
  try { localStorage.setItem('pv-auto-suggest', autoSuggest.value ? '1' : '0') } catch {}
  if (autoSuggest.value) revealSuggestion(); else showSuggestion.value = false
}

function loadDraft() {
  const c = current.value
  showSuggestion.value = false
  if (autoSuggest.value) revealSuggestion()
  saveError.value = ''
  draft.conditional = false
  draft.conditions = ''
  draft.pick = null
  if (c?.decided) {
    if (c.value !== null) draft.pick = String(c.value)
    else if (c.stanceStatus) draft.pick = c.stanceStatus
    if (c.stanceStatus === 'conditional') { draft.conditional = true; draft.conditions = c.conditions ?? '' }
  }
}
function go(i: number) { index.value = Math.max(0, Math.min(items.value.length - 1, i)); loadDraft() }
function goPending() {
  const n = items.value.length
  for (let k = 1; k <= n; k++) { const i = (index.value + k) % n; if (!items.value[i].decided) return go(i) }
}

async function save() {
  if (!canSave.value || !current.value) return
  saving.value = true
  saveError.value = ''
  const pick = draft.pick as string
  const body = isValuePick.value
    ? { kind: 'value', value: Number(pick), conditional: draft.conditional && pick !== '0', conditions: draft.conditions, suggestionShown: showSuggestion.value }
    : { kind: 'exclude', status: pick, suggestionShown: showSuggestion.value }
  try {
    await $fetch(`/api/admin/position-values/${current.value.positionId}`, { method: 'PUT', body })
    const at = index.value
    await refresh()
    const next = items.value.findIndex((it, i) => i > at && !it.decided)
    go(next >= 0 ? next : Math.min(at + 1, items.value.length - 1))
  } catch (e: any) {
    saveError.value = e?.data?.statusMessage || e?.statusMessage || 'No se pudo guardar'
  } finally {
    saving.value = false
  }
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text'))) return
  const n = Number(e.key)
  if (n >= 1 && n <= 5) draft.pick = OPTIONS[n - 1].key
}

onMounted(() => {
  try { const v = localStorage.getItem('pv-auto-suggest'); if (v !== null) autoSuggest.value = v === '1' } catch {}
  const first = items.value.findIndex((i) => !i.decided)
  go(first >= 0 ? first : 0)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.progress { min-width: 200px; font-size: 0.875rem; color: var(--ink-2); }
.progress .bar-container { margin-top: 0.375rem; }
.item-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: var(--ink-3); font-size: 0.875rem; }
.meta { margin: 0 0 0.25rem; color: var(--ink-3); font-size: 0.8125rem; font-weight: 600; display: flex; gap: 0.5rem; align-items: center; }
.proposition { margin: 0 0 1.25rem; font-size: 1.25rem; line-height: 1.35; font-weight: 650; text-wrap: balance; }
.claims { margin: 0 0 1.5rem; padding: 0; list-style: none; display: grid; gap: 0.75rem; }
.claims blockquote { margin: 0; padding: 0.875rem 1rem; background: var(--sunken); border-radius: var(--radius); line-height: 1.55; max-width: 75ch; }
.claim-meta { margin: 0.375rem 0 0; display: flex; gap: 1rem; font-size: 0.8125rem; color: var(--ink-3); }
.choices { margin: 0 0 1rem; padding: 0; border: 0; display: grid; gap: 0.5rem; }
.choices legend { padding: 0; margin-bottom: 0.5rem; font-weight: 600; }
.choice { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.625rem 1rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); cursor: pointer; transition: border-color 0.15s ease-out, background-color 0.15s ease-out; }
.choice:hover { border-color: #aab1bf; }
.choice.selected { border-color: var(--accent); background: var(--accent-tint); }
.choice input { margin-top: 0.25rem; accent-color: var(--accent); }
.choice-text small { display: block; color: var(--ink-3); font-size: 0.8125rem; }
kbd { margin-left: 0.375rem; padding: 0 0.375rem; border: 1px solid var(--line-strong); border-radius: 4px; font-size: 0.75rem; color: var(--ink-3); background: var(--surface); }
.cond { margin-bottom: 1rem; display: grid; gap: 0.5rem; }
.check { display: flex; gap: 0.5rem; align-items: center; font-weight: 500; }
.suggestion { margin: 0 0 1rem; display: grid; gap: 0.5rem; justify-items: start; }
.translation { margin: 0.375rem 0 0; font-size: 0.875rem; color: var(--ink-2); }
.check.auto { font-weight: 400; font-size: 0.875rem; }
.hint { margin: 0; color: var(--ink-2); font-size: 0.875rem; padding: 0.5rem 0.75rem; background: var(--warn-tint); border-radius: var(--radius); }
</style>
