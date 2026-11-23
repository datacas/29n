<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>Etiquetado de referencia</h1>
        <p class="subtitle">
          Lee la proposición y las citas literales y elige la postura que expresan.
          No verás la propuesta de Claude ni la de Jev: tu criterio es la referencia.
        </p>
      </div>
      <div class="progress" role="status">
        <strong>{{ labeledCount }}/{{ items.length }}</strong> etiquetadas
        <div class="bar-container" aria-hidden="true">
          <div class="bar" :style="{ width: pct + '%' }" />
        </div>
      </div>
    </div>

    <p v-if="error" class="error" role="alert">{{ error.statusMessage || 'No se pudo cargar la muestra' }}</p>

    <template v-else-if="current">
      <div class="form-card annotator">
        <div class="form-field">
          <label for="annotator">Quién etiqueta</label>
          <input id="annotator" v-model="annotator" type="text" maxlength="80" placeholder="Nombre o iniciales" />
        </div>
      </div>

      <div class="item-nav">
        <button type="button" class="btn-secondary" :disabled="index === 0" @click="go(index - 1)">← Anterior</button>
        <span>Posición {{ index + 1 }} de {{ items.length }}</span>
        <button type="button" class="btn-secondary" :disabled="index === items.length - 1" @click="go(index + 1)">
          Siguiente →
        </button>
        <button type="button" class="btn-secondary" :disabled="!nextPending" @click="goPending">
          Siguiente sin etiquetar
        </button>
      </div>

      <article class="form-card item">
        <p class="meta">{{ current.questionId }} · {{ current.party }}</p>
        <h2 class="proposition">{{ current.question }}</h2>

        <h3>Citas del programa ({{ current.claims.length }})</h3>
        <ol class="claims">
          <li v-for="(c, i) in current.claims" :key="i">
            <blockquote>«{{ c.literalText }}»</blockquote>
            <p class="claim-meta">
              <span v-if="c.page">pág. {{ c.page }}</span>
              <span v-if="hasConditions(c.conditions)">Condiciones: {{ c.conditions }}</span>
            </p>
          </li>
        </ol>

        <fieldset class="choices">
          <legend>¿Qué postura expresan estas citas ante la proposición?</legend>
          <label v-for="(o, i) in OPTIONS" :key="o.value" class="choice" :class="{ selected: draft.stance === o.value }">
            <input v-model="draft.stance" type="radio" name="stance" :value="o.value" />
            <span class="choice-text">
              <strong>{{ o.label }}</strong> <kbd>{{ i + 1 }}</kbd>
              <small>{{ o.help }}</small>
            </span>
          </label>
        </fieldset>

        <fieldset class="choices inline">
          <legend>¿La evidencia basta para sostener esa postura? (opcional)</legend>
          <label v-for="o in EVIDENCE" :key="String(o.value)" class="choice small" :class="{ selected: draft.evidence === o.value }">
            <input v-model="draft.evidence" type="radio" name="evidence" :value="o.value" />
            <span>{{ o.label }}</span>
          </label>
        </fieldset>

        <div class="form-field">
          <label for="notes">Notas (opcional)</label>
          <textarea id="notes" v-model="draft.notes" rows="2" maxlength="1000" />
        </div>

        <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
        <div class="form-actions">
          <button type="button" class="btn-primary" :disabled="!canSave || saving" @click="save">
            {{ saving ? 'Guardando…' : 'Guardar y continuar' }}
          </button>
          <span v-if="!annotator.trim()" class="hint">Indica quién etiqueta para poder guardar.</span>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

interface Claim { literalText: string; page: number | null; conditions: string | null }
interface Item {
  positionId: string
  questionId: string
  party: string
  question: string
  claims: Claim[]
  human: { stance: string | null; evidenceSufficient: boolean | null; annotator: string | null; notes: string }
}

const OPTIONS = [
  { value: 'supports', label: 'Apoya', help: 'Apoyo claro a la proposición, sin condiciones que lo cambien.' },
  { value: 'opposes', label: 'Se opone', help: 'Oposición clara a la proposición.' },
  { value: 'conditional', label: 'Condicionada', help: 'Apoyo u oposición sujetos a condiciones, matices o alcance limitado relevantes.' },
  { value: 'unclear', label: 'No claro', help: 'Las citas son vagas, genéricas o no permiten decidir.' },
  { value: 'contradictory', label: 'Contradictoria', help: 'Las citas se contradicen entre sí respecto a la proposición.' }
]
const EVIDENCE = [
  { value: true, label: 'Sí' },
  { value: false, label: 'No' },
  { value: null, label: 'Sin indicar' }
]

const { data, error, refresh } = await useFetch<{ items: Item[]; labeled: number; total: number }>('/api/admin/jev-labeling')
const items = computed(() => data.value?.items ?? [])
const labeledCount = computed(() => items.value.filter((i) => i.human.stance && i.human.annotator).length)
const pct = computed(() => (items.value.length ? Math.round((labeledCount.value / items.value.length) * 100) : 0))

const index = ref(0)
const current = computed(() => items.value[index.value])
const annotator = ref('')
const saving = ref(false)
const saveError = ref('')
const draft = reactive<{ stance: string | null; evidence: boolean | null; notes: string }>({
  stance: null,
  evidence: null,
  notes: ''
})

const hasConditions = (c: string | null) => !!c && !/^(ning|no (se )?(hay|mencion|especific|indic)|sin condicion|n\/a|—|-)/i.test(c.trim())
const canSave = computed(() => !!draft.stance && !!annotator.value.trim())
const nextPending = computed(() => items.value.some((i) => !i.human.stance))

function loadDraft() {
  const h = current.value?.human
  draft.stance = h?.stance ?? null
  draft.evidence = h?.evidenceSufficient ?? null
  draft.notes = h?.notes ?? ''
  saveError.value = ''
}

function go(i: number) {
  index.value = Math.max(0, Math.min(items.value.length - 1, i))
  loadDraft()
}

function goPending() {
  const n = items.value.length
  for (let k = 1; k <= n; k++) {
    const i = (index.value + k) % n
    if (!items.value[i].human.stance) return go(i)
  }
}

async function save() {
  if (!canSave.value || !current.value) return
  saving.value = true
  saveError.value = ''
  try {
    await $fetch(`/api/admin/jev-labeling/${current.value.positionId}`, {
      method: 'PUT',
      body: {
        stance: draft.stance,
        evidenceSufficient: draft.evidence,
        annotator: annotator.value.trim(),
        notes: draft.notes
      }
    })
    try { localStorage.setItem('spike12-annotator', annotator.value.trim()) } catch {}
    const at = index.value
    await refresh()
    const pending = items.value.findIndex((it, i) => i > at && !it.human.stance)
    go(pending >= 0 ? pending : Math.min(at + 1, items.value.length - 1))
  } catch (e: any) {
    saveError.value = e?.data?.statusMessage || e?.statusMessage || 'No se pudo guardar'
  } finally {
    saving.value = false
  }
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t && (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text' || t.tagName === 'TEXTAREA')) return
  const n = Number(e.key)
  if (n >= 1 && n <= OPTIONS.length) draft.stance = OPTIONS[n - 1].value
}

onMounted(() => {
  try { annotator.value = localStorage.getItem('spike12-annotator') ?? '' } catch {}
  const first = items.value.findIndex((i) => !i.human.stance)
  go(first >= 0 ? first : 0)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.progress { min-width: 200px; font-size: 0.875rem; color: var(--ink-2); }
.progress .bar-container { margin-top: 0.375rem; }
.annotator { max-width: 360px; }
.item-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: var(--ink-3); font-size: 0.875rem; }
.meta { margin: 0 0 0.25rem; color: var(--ink-3); font-size: 0.8125rem; font-weight: 600; }
.proposition { margin: 0 0 1.25rem; font-size: 1.25rem; line-height: 1.35; font-weight: 650; text-wrap: balance; }
.claims { margin: 0 0 1.5rem; padding: 0; list-style: none; display: grid; gap: 0.75rem; }
.claims blockquote { margin: 0; padding: 0.875rem 1rem; background: var(--sunken); border-radius: var(--radius); font-size: 1rem; line-height: 1.55; max-width: 75ch; }
.claim-meta { margin: 0.375rem 0 0; display: flex; gap: 1rem; font-size: 0.8125rem; color: var(--ink-3); }
.choices { margin: 0 0 1.25rem; padding: 0; border: 0; display: grid; gap: 0.5rem; }
.choices legend { padding: 0; margin-bottom: 0.5rem; font-weight: 600; }
.choices.inline { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.choices.inline legend { flex-basis: 100%; }
.choice { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 1rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); cursor: pointer; transition: border-color 0.15s ease-out, background-color 0.15s ease-out; }
.choice:hover { border-color: #aab1bf; }
.choice.selected { border-color: var(--accent); background: var(--accent-tint); }
.choice.small { padding: 0.375rem 0.875rem; align-items: center; }
.choice input { margin-top: 0.25rem; accent-color: var(--accent); }
.choice.small input { margin-top: 0; }
.choice-text small { display: block; color: var(--ink-3); font-size: 0.8125rem; }
kbd { margin-left: 0.375rem; padding: 0 0.375rem; border: 1px solid var(--line-strong); border-radius: 4px; font-size: 0.75rem; color: var(--ink-3); background: var(--surface); }
.hint { color: var(--ink-3); font-size: 0.8125rem; align-self: center; }
</style>
