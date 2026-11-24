/**
 * Selección dinámica de preguntas según los partidos elegidos y la profundidad.
 *
 *  - Solo salen preguntas sobre las que al menos dos de los partidos elegidos tienen posición
 *    (o todas, si se compara un único partido). Una pregunta que solo puntúa a un partido
 *    puede subirle o bajarle la media sin contrapeso en los demás: por eso se descarta.
 *  - Las preguntas regionales salen todas las de los partidos elegidos (y solo si se elige su partido),
 *    y se SUMAN al total: cada una suele puntuar solo a la formación de esa comunidad.
 *  - El nº de preguntas generales es un objetivo por profundidad, acotado por lo que esos partidos cubren de verdad.
 *    El total fluctúa: objetivo + regionales de los partidos elegidos.
 *  - Reparto equilibrado por dimensión (todas las áreas representadas) y un tema no repite hasta agotar el resto.
 *  - Dentro de cada dimensión se priorizan las preguntas con más partidos con posición y que más los separan.
 *  - Profundidad «total»: entran TODAS las preguntas sobre las que algún partido elegido tiene posición, sin
 *    objetivo ni cupos. Una pregunta que solo trata a uno suma o resta solo a ese partido (no puntúa a los demás).
 */
export type DepthMode = 'quick' | 'normal' | 'deep' | 'total'

/** Parte del cuestionario general reservada a preguntas de contrapeso (tema «bal-…»). */
export const BALANCE_SHARE = 0.2

export const TARGET_QUESTIONS: Record<DepthMode, number> = { quick: 16, normal: 32, deep: 56, total: Infinity }

export interface SelQuestion {
  questionId: string
  depthLevel?: number | null
  dimensionCode?: string | null
  themeCode?: string | null
  regionalParties?: string[] | null
}
export interface SelPosition {
  entityId: string
  questionId: string
  value: number | null
  stanceStatus?: string | null
}
export interface SelEntity {
  entityId: string
  name: string
}

const INCLUDED = new Set(['approved', 'conditional', 'explicit_neutral'])

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

/** Nivel máximo de pregunta por profundidad en el modo exhaustivo (1 = comparativa, 2 = de dos programas, 3 = de uno). */
export const EXHAUSTIVE_LEVEL: Record<DepthMode, number> = { quick: 1, normal: 2, deep: 3, total: Infinity }

export function selectQuestions<Q extends SelQuestion>(
  questions: Q[],
  positions: SelPosition[],
  entities: SelEntity[],
  selectedEntityIds: string[],
  mode: DepthMode,
  target: number = TARGET_QUESTIONS[mode],
  exhaustive = false
): Q[] {
  const chosenIds = selectedEntityIds.length ? selectedEntityIds : entities.map((e) => e.entityId)
  const chosen = new Set(chosenIds)

  // Modo exhaustivo (encuesta histórica) y profundidad «total» (cualquier encuesta): la profundidad la marca el
  // nivel de cada pregunta (en «total», sin tope) y entran todas las de ese nivel sobre las que algún partido
  // elegido tiene posición. Una pregunta que solo trata a uno suma o resta solo a ese: para los demás no puntúa.
  // Orden: el del banco, que ya viene por dimensión.
  if (exhaustive || mode === 'total') {
    const max = EXHAUSTIVE_LEVEL[mode]
    const withChosen = new Set(
      positions
        .filter((p) => chosen.has(p.entityId) && p.value !== null && p.value !== undefined && (!p.stanceStatus || INCLUDED.has(p.stanceStatus)))
        .map((p) => p.questionId)
    )
    return questions.filter((q) => (q.depthLevel ?? 1) <= max && withChosen.has(q.questionId))
  }
  const names = new Set(entities.filter((e) => chosen.has(e.entityId)).map((e) => e.name))

  // valores de los partidos elegidos por pregunta
  const values = new Map<string, number[]>()
  for (const p of positions) {
    if (!chosen.has(p.entityId) || p.value === null || p.value === undefined) continue
    if (p.stanceStatus && !INCLUDED.has(p.stanceStatus)) continue
    if (!values.has(p.questionId)) values.set(p.questionId, [])
    values.get(p.questionId)!.push(p.value)
  }

  // Partidos con posición utilizable por pregunta (en todo el cuestionario, elijas a quien elijas)
  const holders = new Map<string, Set<string>>()
  for (const p of positions) {
    if (p.value === null || p.value === undefined) continue
    if (p.stanceStatus && !INCLUDED.has(p.stanceStatus)) continue
    if (!holders.has(p.questionId)) holders.set(p.questionId, new Set())
    holders.get(p.questionId)!.add(p.entityId)
  }

  interface Cand { q: Q; score: number; regional: boolean; index: number }
  // Con dos o más partidos, una pregunta debe puntuar al menos a dos: si solo tiene
  // posición de uno, se excluye para no darle una ventaja sin contrapeso.
  const minShared = Math.min(2, chosen.size)
  const cands: Cand[] = []
  questions.forEach((q, index) => {
    const vals = values.get(q.questionId) ?? []
    // Pregunta «de partido»: regional, o con posición de un único partido en todo el cuestionario.
    // Solo sale si se elige ese partido, se SUMA al total y se exime del mínimo de 2 partidos.
    const soloHolder = holders.get(q.questionId)
    const exclusiveToOne = !q.regionalParties?.length && soloHolder?.size === 1
    const regional = !!q.regionalParties?.length || exclusiveToOne
    if (vals.length < (regional ? 1 : minShared)) return
    if (q.regionalParties?.length && !q.regionalParties.some((n) => names.has(n))) return
    if (exclusiveToOne && !chosen.has([...soloHolder!][0])) return
    const coverage = vals.length / chosen.size
    const spread = vals.length > 1 ? Math.min(1, stddev(vals) / 2) : 0.5
    cands.push({ q, score: coverage * (0.6 + 0.4 * spread), regional, index })
  })

  // Las regionales se SUMAN al cuestionario: el objetivo por profundidad se refiere a las preguntas generales.
  const regionals = cands.filter((c) => c.regional).sort((a, b) => b.score - a.score || a.index - b.index)
  const general = cands.filter((c) => !c.regional)
  const n = Math.min(target, general.length) + regionals.length
  const picked = new Set<Cand>()

  // Cupo de contrapeso: preguntas formuladas para que el «sí» sea la postura de mercado, libertad u orden
  // (tema «bal-…»). Sin cupo casi nunca entrarían, porque las contestan menos partidos. Compensa el sesgo
  // de quien responde «de acuerdo» a todo, y no se puede dejar al criterio de la cobertura.
  const balance = general.filter((c) => (c.q.themeCode ?? '').startsWith('bal-')).sort((a, b) => b.score - a.score || a.index - b.index)
  for (const c of balance.slice(0, Math.min(balance.length, Math.round(Math.min(target, general.length) * BALANCE_SHARE)))) picked.add(c)

  // 1) regionales de los partidos elegidos: entran todas, sin tope
  for (const c of regionals) picked.add(c)

  // 2) resto: reparto por dimensión en turnos; un tema no repite hasta agotar los demás
  const rest = cands.filter((c) => !c.regional && !picked.has(c)).sort((a, b) => b.score - a.score || a.index - b.index)
  const byDim = new Map<string, Cand[]>()
  for (const c of rest) {
    const d = c.q.dimensionCode ?? '—'
    if (!byDim.has(d)) byDim.set(d, [])
    byDim.get(d)!.push(c)
  }
  const dims = [...byDim.keys()].sort((a, b) => byDim.get(b)!.length - byDim.get(a)!.length || a.localeCompare(b))
  const themesUsed = new Set<string>([...picked].map((c) => c.q.themeCode ?? c.q.questionId))
  for (const allowRepeat of [false, true]) {
    let progressed = true
    while (picked.size < n && progressed) {
      progressed = false
      for (const d of dims) {
        if (picked.size >= n) break
        const list = byDim.get(d)!
        const i = list.findIndex((c) => !picked.has(c) && (allowRepeat || !themesUsed.has(c.q.themeCode ?? c.q.questionId)))
        if (i >= 0) {
          picked.add(list[i])
          themesUsed.add(list[i].q.themeCode ?? list[i].q.questionId)
          progressed = true
        }
      }
    }
  }

  // orden final: por dimensión y, dentro de ella, el del banco de preguntas
  return [...picked]
    .sort((a, b) => (a.q.dimensionCode ?? '').localeCompare(b.q.dimensionCode ?? '') || a.index - b.index)
    .map((c) => c.q)
}
