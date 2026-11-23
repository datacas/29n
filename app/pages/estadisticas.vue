<template>
  <div class="st">
    <!-- Portada: cifras grandes que cuentan hacia arriba al entrar -->
    <section class="st__hero">
      <div class="wrap wrap--wide st__heroin">
        <p class="st__eyebrow">29N · en directo</p>
        <h1 class="st__title">Qué piensa la gente<br><span>que ha hecho el test</span></h1>
        <template v-if="ready">
          <div class="st__big">
            <div><b class="tnum">{{ fmtNum(anim.completed) }}</b><span>encuestas terminadas</span></div>
            <div><b class="tnum">{{ fmtNum(anim.answers) }}</b><span>respuestas compartidas</span></div>
            <div><b class="tnum">{{ data.completionRate ?? '—' }}<small v-if="data.completionRate !== null">%</small></b><span>de quien empieza, termina</span></div>
          </div>
          <!-- Embudo proporcional -->
          <div class="st__funnel" role="img" :aria-label="`Empiezan ${fmt(data.started)}, terminan ${fmt(data.completed)}, comparten ${fmt(data.contributions)}`">
            <div v-for="f in funnel" :key="f.label" class="st__fstep">
              <span class="st__fbar" :style="{ '--w': `${f.pct}%` }" />
              <span class="st__flab"><b class="tnum">{{ fmt(f.n) }}</b> {{ f.label }}</span>
            </div>
          </div>
        </template>
      </div>
    </section>

    <div class="wrap wrap--wide st__body">
      <p v-if="pending" class="loading">Cargando...</p>
      <p v-else-if="error || !data?.ok" class="note note--alert" role="alert">Las estadísticas no están disponibles ahora mismo.</p>

      <section v-else-if="!data.visible" class="st__soon">
        <h2>Las estadísticas se abren pronto</h2>
        <p>Se publican cuando al menos {{ data.minCount }} personas han terminado la encuesta, para que ningún dato se apoye en muy pocas respuestas.</p>
        <NuxtLink :to="`/survey/${releaseId}/start`" class="btn-primary">Hacer la encuesta</NuxtLink>
      </section>

      <template v-else>
        <p class="st__warn"><strong>No es una encuesta electoral.</strong> Solo refleja a quien ha usado 29N y ha querido compartir sus respuestas, que no es una muestra representativa. No sirve para estimar votos. Ninguna cifra se muestra si se apoya en menos de {{ data.minCount }} personas.</p>

        <!-- Afinidad -->
        <section class="st__sec" aria-labelledby="h-af">
          <header class="st__head">
            <p class="st__kicker">01</p>
            <h2 id="h-af">Con qué programas coincide la gente</h2>
            <p>Afinidad media de quien comparte su resultado. Pasa el ratón o toca un partido para ver cómo se reparte.</p>
          </header>
          <p v-if="!parties.length" class="st__empty">Aún no hay suficientes resultados compartidos.</p>
          <ol v-else class="st__parties" v-reveal>
            <li v-for="(p, i) in parties" :key="p.entityId" class="st__party" :style="{ '--i': i }" tabindex="0">
              <span class="st__rank tnum">{{ i + 1 }}</span>
              <span class="st__pname">{{ p.name }}</span>
              <span class="st__track"><span class="st__fill" :style="{ '--w': `${p.mean}%` }" /></span>
              <span class="st__pval tnum">{{ p.mean }}<small>%</small></span>
              <span class="st__pmeta small tnum">
                <template v-if="p.top">Sale 1.º en {{ p.top }} {{ p.top === 1 ? 'resultado' : 'resultados' }} · </template>{{ p.total }} resultados
              </span>
              <!-- Reparto por tramos de 10 % -->
              <span class="st__hist" aria-hidden="true">
                <span v-for="(b, bi) in p.buckets" :key="bi" :style="{ '--h': `${p.maxB ? ((b ?? 0) / p.maxB) * 100 : 0}%` }" :title="`${bi * 10}–${Math.min(100, bi * 10 + 9)} %: ${b === null ? 'menos de ' + data.minCount : b}`" />
              </span>
            </li>
          </ol>
          <div v-if="topShare.length" class="st__podium">
            <p class="st__kicker">Quién sale primero</p>
            <div class="st__share" role="img" :aria-label="topShare.map(t => `${t.name} ${t.pct} %`).join(', ')">
              <span v-for="(t, i) in topShare" :key="t.entityId" :style="{ flexGrow: t.pct, '--o': 1 - i * 0.14 }" :title="`${t.name}: ${t.pct} %`"><em v-if="t.pct >= 9">{{ t.name }} {{ t.pct }} %</em></span>
            </div>
          </div>
        </section>

        <!-- Destacadas -->
        <section v-if="highlights" class="st__sec" aria-labelledby="h-hl">
          <header class="st__head">
            <p class="st__kicker">02</p>
            <h2 id="h-hl">Lo que une y lo que divide</h2>
          </header>
          <div class="st__cards" v-reveal>
            <article class="st__card st__card--yes">
              <p class="st__ctag">Más consenso</p>
              <p class="st__cbig tnum">{{ highlights.consensus.lead }}%</p>
              <p class="st__cq">{{ highlights.consensus.text }}</p>
              <p class="small">{{ highlights.consensus.leadLabel }}</p>
            </article>
            <article class="st__card st__card--split">
              <p class="st__ctag">Más dividida</p>
              <p class="st__cbig tnum">{{ highlights.divisive.agree }}<span>/</span>{{ highlights.divisive.disagree }}</p>
              <p class="st__cq">{{ highlights.divisive.text }}</p>
              <p class="small">a favor / en contra</p>
            </article>
            <article class="st__card">
              <p class="st__ctag">La más dudosa</p>
              <p class="st__cbig tnum">{{ highlights.unsure.unsure }}%</p>
              <p class="st__cq">{{ highlights.unsure.text }}</p>
              <p class="small">responde «No sé» o la omite</p>
            </article>
          </div>
        </section>

        <!-- Respuestas por pregunta: barras divergentes centradas en 0 -->
        <section class="st__sec" aria-labelledby="h-q">
          <header class="st__head">
            <p class="st__kicker">03</p>
            <h2 id="h-q">Pregunta a pregunta</h2>
            <p>A la izquierda, en contra; a la derecha, a favor. En gris, «No sé» y omitidas.</p>
          </header>
          <p v-if="!questions.length" class="st__empty">Aún no hay suficientes respuestas compartidas.</p>
          <template v-else>
            <div class="st__tools">
              <div class="st__chips" role="group" aria-label="Filtrar por tema">
                <button v-for="t in themes" :key="t" type="button" class="st__chip" :aria-pressed="theme === t" @click="theme = t">{{ t }}</button>
              </div>
              <label class="st__sort">Ordenar
                <select v-model="sort">
                  <option value="agree">Más a favor</option>
                  <option value="disagree">Más en contra</option>
                  <option value="divisive">Más divididas</option>
                  <option value="survey">Orden de la encuesta</option>
                </select>
              </label>
            </div>
            <div class="st__legend small" aria-hidden="true">
              <span><i class="c-2" />Totalmente en contra</span><span><i class="c-1" />En contra</span>
              <span><i class="cn" />No sé / omitida</span>
              <span><i class="c1" />A favor</span><span><i class="c2" />Totalmente a favor</span>
            </div>
            <TransitionGroup tag="ul" name="st-list" class="st__qs">
              <li v-for="q in shownQuestions" :key="q.questionId" class="st__q">
                <p class="st__qt">{{ q.text }}</p>
                <div class="st__div" role="img" :aria-label="q.aria">
                  <span class="st__neg">
                    <span class="c-2" :style="{ width: `${q.p['-2']}%` }" :title="`Totalmente en contra: ${r(q.p['-2'])} %`" />
                    <span class="c-1" :style="{ width: `${q.p['-1']}%` }" :title="`En contra: ${r(q.p['-1'])} %`" />
                  </span>
                  <span class="st__axis" />
                  <span class="st__pos">
                    <span class="c1" :style="{ width: `${q.p['1']}%` }" :title="`A favor: ${r(q.p['1'])} %`" />
                    <span class="c2" :style="{ width: `${q.p['2']}%` }" :title="`Totalmente a favor: ${r(q.p['2'])} %`" />
                  </span>
                  <span class="st__unsure" :title="`No sé u omitida: ${r(q.unsure)} %`"><span :style="{ width: `${q.unsure}%` }" /></span>
                </div>
                <p class="st__qn small tnum"><span class="t-no">{{ q.disagree }} % en contra</span><span /><span class="t-yes">{{ q.agree }} % a favor</span><span class="st__qtot">{{ r(q.unsure) }} % no sabe · {{ q.total }}</span></p>
              </li>
            </TransitionGroup>
            <button v-if="filteredQuestions.length > shownQuestions.length" type="button" class="btn btn-secondary st__more" @click="limit += 15">Ver más preguntas ({{ filteredQuestions.length - shownQuestions.length }})</button>
          </template>
        </section>

        <!-- Uso -->
        <section class="st__sec" aria-labelledby="h-uso">
          <header class="st__head">
            <p class="st__kicker">04</p>
            <h2 id="h-uso">Cómo se usa</h2>
          </header>
          <div class="st__usage">
            <div>
              <h3>Profundidad elegida</h3>
              <div class="st__donutwrap">
                <svg viewBox="0 0 42 42" class="st__donut" role="img" :aria-label="modeItems.map(m => `${m.label} ${m.pct} %`).join(', ')">
                  <circle cx="21" cy="21" r="15.9" fill="none" class="st__ring" stroke-width="6" />
                  <circle v-for="(m, i) in modeArcs" :key="m.label" cx="21" cy="21" r="15.9" fill="none" stroke-width="6"
                          :class="`st__arc st__arc${i}`" :stroke-dasharray="`${Math.max(0, m.pct - 1)} ${101 - m.pct}`" :stroke-dashoffset="25 - m.offset" />
                </svg>
                <ul class="st__dlegend">
                  <li v-for="(m, i) in modeItems" :key="m.label"><i :class="`st__arc${i}`" />{{ m.label }} <b class="tnum">{{ m.n === null ? '—' : `${m.pct} %` }}</b></li>
                </ul>
              </div>
            </div>
            <div>
              <h3>Dispositivo</h3>
              <div v-for="d in deviceItems" :key="d.label" class="st__dev">
                <span>{{ d.label }}</span>
                <span class="st__track"><span class="st__fill" :style="{ '--w': `${d.pct}%` }" /></span>
                <b class="tnum">{{ d.n === null ? '—' : `${d.pct} %` }}</b>
              </div>
            </div>
            <div class="st__spark">
              <h3>Encuestas terminadas por día</h3>
              <svg v-if="spark" :viewBox="`0 0 ${spark.w} 60`" preserveAspectRatio="none" role="img" :aria-label="`Encuestas terminadas en los últimos ${spark.n} días`">
                <path :d="spark.area" class="st__sparea" />
                <path :d="spark.line" class="st__spline" />
              </svg>
              <p v-else class="small">Aún hay pocos días con datos.</p>
              <details class="st__days">
                <summary>Ver la tabla</summary>
                <table><thead><tr><th>Día</th><th>Empiezan</th><th>Terminan</th></tr></thead>
                  <tbody><tr v-for="d in data.days" :key="d.day"><td>{{ d.day }}</td><td class="tnum">{{ fmt(d.started) }}</td><td class="tnum">{{ fmt(d.completed) }}</td></tr></tbody>
                </table>
              </details>
            </div>
          </div>
        </section>

        <section class="st__cta">
          <h2>Suma tu opinión</h2>
          <p>Haz la encuesta y, al terminar, marca «Compartir de forma anónima». Cuantas más personas, más interesantes son estos datos.</p>
          <div class="st__ctab">
            <NuxtLink :to="`/survey/${releaseId}/start`" class="btn-primary">Hacer la encuesta</NuxtLink>
            <KofiButton />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import surveysJson from '~/data/surveys.json'

useHead({ title: '29N · Estadísticas', meta: [{ name: 'robots', content: 'noindex' }] })

const surveys = surveysJson as any[]
const releaseId = surveys[0]?.release_id ?? ''

const { data, pending, error } = await useFetch<any>('/api/stats/summary', { query: { release: releaseId }, server: false })
const { data: release } = await useFetch<any>(`/data/releases/${releaseId}.json`, { server: false })

const ready = computed(() => !!data.value?.ok && data.value.visible)
const min = computed(() => data.value?.minCount ?? 10)
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? `< ${min.value}` : n.toLocaleString('es-ES'))
const fmtNum = (n: number) => Math.round(n).toLocaleString('es-ES')
const r = (n: number) => Math.round(n)
const entityName = (id: string) => release.value?.entities?.find((e: any) => e.entityId === id)?.name ?? null

// Contadores animados en la portada (sin animación si se pide movimiento reducido)
const totalAnswers = computed(() => (data.value?.questions ?? []).reduce((s: number, q: any) => s + q.total, 0))
const anim = reactive({ completed: 0, answers: 0 })
watch([ready, totalAnswers], ([ok]) => {
  if (!ok || !import.meta.client) return
  const to = { completed: data.value.completed ?? 0, answers: totalAnswers.value }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(anim, to); return }
  const t0 = performance.now(), dur = 1400
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4)
    anim.completed = to.completed * e; anim.answers = to.answers * e
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}, { immediate: true })

const funnel = computed(() => {
  const s = data.value?.started ?? 0
  return [
    { label: 'empiezan', n: data.value?.started, pct: 100 },
    { label: 'terminan', n: data.value?.completed, pct: s ? ((data.value?.completed ?? 0) / s) * 100 : 0 },
    { label: 'comparten sus respuestas', n: data.value?.contributions, pct: s ? ((data.value?.contributions ?? 0) / s) * 100 : 0 }
  ]
})

// Afinidad por partido (solo partidos de la encuesta publicada)
const parties = computed(() => (data.value?.parties ?? [])
  .map((p: any) => ({ ...p, name: entityName(p.entityId), maxB: Math.max(...p.buckets.map((b: number | null) => b ?? 0)) }))
  .filter((p: any) => p.name)
  .sort((a: any, b: any) => b.mean - a.mean))

const topShare = computed(() => {
  const list = parties.value.filter((p: any) => p.top)
  const sum = list.reduce((s: number, p: any) => s + p.top, 0)
  return sum ? list.map((p: any) => ({ entityId: p.entityId, name: p.name, pct: Math.round((p.top / sum) * 100) })).sort((a: any, b: any) => b.pct - a.pct) : []
})

// Preguntas
const questions = computed(() => {
  const byId = new Map((release.value?.questions ?? []).map((q: any, i: number) => [q.questionId, { ...q, order: i }]))
  return (data.value?.questions ?? []).flatMap((s: any) => {
    const q: any = byId.get(s.questionId)
    if (!q) return []
    const c = s.counts
    const known = Object.values(c).reduce((a: number, b: any) => a + (b ?? 0), 0) as number
    if (!known) return []
    const p: Record<string, number> = {}
    for (const v of ['-2', '-1', '0', '1', '2', '99']) p[v] = ((c[v] ?? 0) / known) * 100
    const agree = Math.round(p['1'] + p['2']), disagree = Math.round(p['-1'] + p['-2'])
    const unsure = p['0'] + p['99']
    return [{
      questionId: s.questionId, text: q.canonicalText, theme: q.dimensionName || 'Otras', order: q.order,
      total: s.total, p, agree, disagree, unsure,
      split: Math.min(agree, disagree) / Math.max(1, Math.max(agree, disagree)) * (agree + disagree),
      aria: `${agree} % a favor, ${disagree} % en contra, ${Math.round(unsure)} % no sabe`
    }]
  })
})
const themes = computed(() => ['Todos', ...new Set(questions.value.map((q: any) => q.theme))])
const theme = ref('Todos')
const sort = ref<'agree' | 'disagree' | 'divisive' | 'survey'>('agree')
const limit = ref(15)
watch([theme, sort], () => { limit.value = 15 })
const filteredQuestions = computed(() => {
  const list = questions.value.filter((q: any) => theme.value === 'Todos' || q.theme === theme.value)
  const by: Record<string, (a: any, b: any) => number> = {
    agree: (a, b) => b.agree - a.agree, disagree: (a, b) => b.disagree - a.disagree,
    divisive: (a, b) => b.split - a.split, survey: (a, b) => a.order - b.order
  }
  return [...list].sort(by[sort.value])
})
const shownQuestions = computed(() => filteredQuestions.value.slice(0, limit.value))

const highlights = computed(() => {
  const q = questions.value
  if (q.length < 3) return null
  const consensusQ = [...q].sort((a, b) => Math.max(b.agree, b.disagree) - Math.max(a.agree, a.disagree))[0]
  const divisive = [...q].sort((a, b) => b.split - a.split)[0]
  const unsure = [...q].sort((a, b) => b.unsure - a.unsure)[0]
  return {
    consensus: { ...consensusQ, lead: Math.max(consensusQ.agree, consensusQ.disagree), leadLabel: consensusQ.agree >= consensusQ.disagree ? 'está a favor' : 'está en contra' },
    divisive,
    unsure: { ...unsure, unsure: Math.round(unsure.unsure) }
  }
})

// Uso
const MODE: Record<string, string> = { quick: 'Rápida', normal: 'Normal', deep: 'Profunda' }
const DEVICE: Record<string, string> = { mobile: 'Móvil', desktop: 'Ordenador' }
const toItems = (rows: any[], labels: Record<string, string>, order: string[]) => {
  const total = rows.reduce((s, x) => s + (x.n ?? 0), 0)
  return [...rows].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map(x => ({ label: labels[x.key] ?? x.key, n: x.n, pct: total && x.n ? Math.round((x.n / total) * 100) : 0 }))
}
const modeItems = computed(() => toItems(data.value?.modes ?? [], MODE, ['quick', 'normal', 'deep']))
const modeArcs = computed(() => { let o = 0; return modeItems.value.map(m => { const a = { ...m, offset: o }; o += m.pct; return a }) })
const deviceItems = computed(() => toItems(data.value?.devices ?? [], DEVICE, ['mobile', 'desktop']))

const spark = computed(() => {
  const days = [...(data.value?.days ?? [])].reverse().map((d: any) => d.completed ?? 0)
  if (days.length < 3) return null
  const w = 300, max = Math.max(1, ...days), dx = w / (days.length - 1)
  const pts = days.map((v, i) => [i * dx, 56 - (v / max) * 50])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')
  return { w, n: days.length, line, area: `${line}L${w},60L0,60Z` }
})

// Aparición al hacer scroll (las barras crecen al entrar en pantalla)
const vReveal = {
  mounted(el: HTMLElement) {
    if (!('IntersectionObserver' in window)) { el.classList.add('is-in'); return }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { el.classList.add('is-in'); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
  }
}
</script>

<style scoped>
.st {
  --yes2: #3f5a34; --yes1: #93a883; --mid: #e3e2dc; --no1: #dca58f; --no2: #9c4421;
  --heroBg: #1d1e1b; --heroInk: #f4f4ef; --heroMuted: #a9ab9f;
}
/* Portada */
.st__hero { background: radial-gradient(120% 140% at 85% -10%, #3c4a33 0%, var(--heroBg) 55%); color: var(--heroInk); overflow: hidden; }
.st__heroin { padding-top: var(--space-6); padding-bottom: var(--space-6); }
.st__eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; font-size: var(--step--1); color: var(--heroMuted); letter-spacing: 0.08em; text-transform: uppercase; }
.st__eyebrow::before { content: ""; width: 0.55rem; height: 0.55rem; border-radius: 50%; background: #9fd08a; box-shadow: 0 0 0 0 #9fd08a88; animation: st-pulse 2s infinite; }
@keyframes st-pulse { 70% { box-shadow: 0 0 0 0.6rem #9fd08a00; } 100% { box-shadow: 0 0 0 0 #9fd08a00; } }
.st__title { color: var(--heroInk); font-size: clamp(2.2rem, 6vw, 4.2rem); line-height: 1; letter-spacing: -0.045em; margin: var(--space-3) 0 var(--space-6); font-weight: 750; }
.st__title span { color: var(--heroMuted); }
.st__big { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-5); }
.st__big b { display: block; font-size: clamp(2.6rem, 7vw, 4.8rem); line-height: 1; letter-spacing: -0.05em; font-weight: 750; }
.st__big small { font-size: 0.5em; color: var(--heroMuted); margin-left: 0.1em; }
.st__big span { color: var(--heroMuted); font-size: var(--step--1); }
.st__funnel { margin-top: var(--space-6); display: grid; gap: 0.5rem; max-width: 44rem; }
.st__fstep { position: relative; height: 2.25rem; border-radius: 8px; background: #ffffff0d; overflow: hidden; }
.st__fbar { position: absolute; inset: 0 auto 0 0; width: var(--w); background: linear-gradient(90deg, #6f8a5f, #a7c293); border-radius: 8px; transform-origin: left; animation: st-grow 1.2s var(--ease) both; }
.st__fstep:nth-child(2) .st__fbar { animation-delay: 0.15s; opacity: 0.85; }
.st__fstep:nth-child(3) .st__fbar { animation-delay: 0.3s; opacity: 0.7; }
.st__flab { position: relative; display: flex; align-items: center; gap: 0.4rem; height: 100%; padding: 0 0.8rem; font-size: var(--step--1); color: #fff; text-shadow: 0 1px 2px #0006; }
@keyframes st-grow { from { transform: scaleX(0); } }

.st__body { padding-top: var(--space-6); padding-bottom: var(--space-7); }
.st__warn { font-size: var(--step--1); color: var(--ink-soft); border-left: 3px solid var(--line-strong); padding-left: var(--space-3); max-width: 50rem; }
.st__soon { text-align: center; padding: var(--space-7) 0; display: grid; gap: var(--space-4); justify-items: center; }
.st__soon p { max-width: 32rem; color: var(--ink-soft); }
.st__sec { margin-top: var(--space-7); }
.st__head { max-width: 40rem; margin-bottom: var(--space-5); }
.st__head h2 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); letter-spacing: -0.035em; line-height: 1.05; }
.st__head p:last-child:not(.st__kicker) { color: var(--ink-soft); margin-top: var(--space-2); }
.st__kicker { font-size: var(--step--1); color: var(--data); font-weight: 700; letter-spacing: 0.08em; margin-bottom: 0.3rem; }
.st__empty { color: var(--muted); }

/* Partidos */
.st__parties { list-style: none; padding: 0; display: grid; gap: 0.35rem; }
.st__party { display: grid; grid-template-columns: 1.6rem minmax(7rem, 13rem) 1fr 4rem; grid-template-areas: "r n t v" ". m m m"; align-items: center; gap: 0.15rem var(--space-3); padding: 0.55rem 0.6rem; border-radius: 10px; position: relative; outline: none; transition: background 0.2s; }
.st__party:hover, .st__party:focus-visible { background: var(--tint); }
.st__party:focus-visible { box-shadow: 0 0 0 2px var(--focus); }
.st__rank { grid-area: r; color: var(--muted); font-size: var(--step--1); }
.st__pname { grid-area: n; font-weight: 600; }
.st__party .st__track { grid-area: t; }
.st__pval { grid-area: v; text-align: right; font-weight: 700; font-size: var(--step-1); }
.st__pval small { font-size: 0.65em; color: var(--muted); }
.st__pmeta { grid-area: m; color: var(--muted); }
.st__track { display: block; height: 0.8rem; background: var(--tint); border-radius: 999px; overflow: hidden; }
.st__fill { display: block; height: 100%; width: var(--w); background: linear-gradient(90deg, var(--data), #8aa078); border-radius: 999px; transform-origin: left; transform: scaleX(0); transition: transform 1.1s var(--ease) calc(var(--i, 0) * 60ms); }
.is-in .st__fill, .st__dev .st__fill { transform: scaleX(1); }
.st__hist { position: absolute; right: 5.2rem; bottom: calc(100% - 0.4rem); display: none; align-items: flex-end; gap: 2px; height: 3.2rem; width: 9rem; padding: 0.4rem; background: var(--tile); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 8px 24px #0002; z-index: 2; }
.st__hist span { flex: 1; height: max(2px, var(--h)); background: var(--data); border-radius: 2px 2px 0 0; }
.st__party:hover .st__hist, .st__party:focus-visible .st__hist { display: flex; }
.st__podium { margin-top: var(--space-5); }
.st__share { display: flex; gap: 2px; height: 2.6rem; border-radius: 10px; overflow: hidden; }
.st__share span { background: color-mix(in oklab, var(--data) calc(var(--o) * 100%), var(--mid)); display: flex; align-items: center; padding: 0 0.6rem; min-width: 4px; }
.st__share em { font-style: normal; font-size: var(--step--1); color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Destacadas */
.st__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--space-4); }
.st__card { background: var(--tile); border: 1px solid var(--line); border-radius: 18px; padding: var(--space-5); display: grid; gap: var(--space-2); align-content: start; opacity: 0; transform: translateY(16px); transition: opacity 0.7s var(--ease), transform 0.7s var(--ease); }
.is-in .st__card { opacity: 1; transform: none; }
.is-in .st__card:nth-child(2) { transition-delay: 0.1s; } .is-in .st__card:nth-child(3) { transition-delay: 0.2s; }
.st__card--yes { background: linear-gradient(160deg, #eef2e8, var(--tile)); }
.st__card--split { background: linear-gradient(160deg, #f6ece6, var(--tile)); }
.st__ctag { font-size: var(--step--1); font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.st__cbig { font-size: 3.2rem; font-weight: 750; letter-spacing: -0.05em; line-height: 1; }
.st__cbig span { color: var(--muted); margin: 0 0.1em; font-weight: 400; }
.st__cq { font-weight: 600; line-height: 1.3; }
.st__card .small { color: var(--muted); }

/* Preguntas */
.st__tools { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.st__chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.st__chip { min-height: 2.5rem; padding: 0 0.9rem; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--tile); color: var(--ink-soft); font: inherit; font-size: var(--step--1); cursor: pointer; transition: all 0.2s; }
.st__chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.st__sort { display: flex; gap: 0.5rem; align-items: center; font-size: var(--step--1); color: var(--muted); }
.st__sort select { min-height: 2.5rem; border-radius: 8px; border: 1px solid var(--line-strong); padding: 0 0.6rem; font: inherit; background: var(--tile); color: var(--ink); }
.st__legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; color: var(--muted); margin-bottom: var(--space-4); }
.st__legend i { display: inline-block; width: 0.75rem; height: 0.75rem; border-radius: 3px; margin-right: 0.35rem; vertical-align: -0.1rem; }
.c2 { background: var(--yes2); } .c1 { background: var(--yes1); } .cn { background: var(--mid); }
.c-1 { background: var(--no1); } .c-2 { background: var(--no2); }
.st__qs { list-style: none; padding: 0; display: grid; gap: var(--space-5); }
.st__qt { font-weight: 500; margin-bottom: 0.45rem; max-width: 52rem; }
.st__div, .st__qn { display: grid; grid-template-columns: 1fr 2px 1fr 7rem; column-gap: 0; align-items: center; height: 1.1rem; gap: 0; }
.st__neg, .st__pos { display: flex; height: 100%; gap: 2px; }
.st__neg { justify-content: flex-end; }
.st__neg span:first-child { border-radius: 4px 0 0 4px; } .st__pos span:last-child { border-radius: 0 4px 4px 0; }
.st__neg span, .st__pos span { height: 100%; transition: width 0.8s var(--ease); }
.st__axis { height: 1.7rem; background: var(--ink); opacity: 0.35; }
.st__unsure { height: 100%; margin-left: 1rem; background: var(--tint); border-radius: 4px; overflow: hidden; }
.st__unsure span { display: block; height: 100%; background: var(--mid); }
.st__qtot { padding-left: 1rem; white-space: nowrap; font-size: 0.78rem; }
.st__qn { margin-top: 0.3rem; color: var(--muted); max-width: none; }
.st__qn .t-yes { padding-left: 0.4rem; } .st__qn .t-no { text-align: right; padding-right: 0.4rem; }
.st__qn .t-yes { color: var(--yes2); font-weight: 600; }
.st__qn .t-no { color: var(--no2); font-weight: 600; }
.st__more { margin-top: var(--space-5); }
.st-list-move, .st-list-enter-active, .st-list-leave-active { transition: all 0.45s var(--ease); }
.st-list-enter-from, .st-list-leave-to { opacity: 0; transform: translateY(8px); }
.st-list-leave-active { position: absolute; }

/* Uso */
.st__usage { display: grid; gap: var(--space-6); grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.st__usage h3 { font-size: var(--step-0); margin-bottom: var(--space-3); }
.st__donutwrap { display: flex; align-items: center; gap: var(--space-4); }
.st__donut { width: 7.5rem; height: 7.5rem; flex: none; }
.st__ring { stroke: var(--tint); }
.st__arc0 { stroke: #93a883; background: #93a883; } .st__arc1 { stroke: #68745c; background: #68745c; } .st__arc2 { stroke: #2f3a28; background: #2f3a28; }
.st__dlegend { list-style: none; padding: 0; display: grid; gap: 0.3rem; font-size: var(--step--1); }
.st__dlegend i { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 50%; margin-right: 0.4rem; }
.st__dev { display: grid; grid-template-columns: 5.5rem 1fr 3rem; gap: var(--space-3); align-items: center; margin-bottom: 0.6rem; font-size: var(--step--1); }
.st__dev b { text-align: right; }
.st__spark svg { width: 100%; height: 4rem; display: block; }
.st__sparea { fill: color-mix(in oklab, var(--data) 18%, transparent); }
.st__spline { fill: none; stroke: var(--data); stroke-width: 2; vector-effect: non-scaling-stroke; }
.st__days { margin-top: var(--space-3); font-size: var(--step--1); }
.st__days table { margin-top: var(--space-2); border-collapse: collapse; }
.st__days td, .st__days th { padding: 0.25rem 1rem 0.25rem 0; text-align: left; }

.st__cta { margin-top: var(--space-7); padding: var(--space-6); border-radius: 22px; background: radial-gradient(120% 160% at 0% 0%, #e7eddf, var(--tint)); display: grid; gap: var(--space-3); }
.st__cta h2 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); letter-spacing: -0.035em; }
.st__cta p { max-width: 36rem; color: var(--ink-soft); }
.st__ctab { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }

@media (max-width: 34rem) {
  .st__party { grid-template-columns: 1.4rem 1fr 3.4rem; grid-template-areas: "r n v" ". t t" ". m m"; }
  .st__hist { display: none !important; }
  .st__unsure { display: none; }
  .st__div, .st__qn { grid-template-columns: 1fr 2px 1fr; }
  .st__qtot { display: none; }
  .st__cta { padding: var(--space-5); }
}
@media (prefers-reduced-motion: reduce) {
  .st *, .st *::before { animation: none !important; transition: none !important; }
  .st__fill { transform: none; } .st__card { opacity: 1; transform: none; }
}
</style>
