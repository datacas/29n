// Fase 1 · Reparto reproducible de celdas para el benchmark reducido de modelos (solo lectura; no llama a ningún modelo).
// Tres conjuntos disjuntos POR PREGUNTA, para evitar fugas al ajustar prompts:
//   S (cribado de modelos) y D (ajuste de prompt/manual) salen de las preguntas de desarrollo;
//   E (evaluación final = candidato al piloto humano) sale de preguntas que S y D nunca ven y queda SELLADO (huella en el fichero).
import crypto from 'node:crypto'
import { loadRelease, usable, rng, write } from './lib.mjs'

const version = process.argv[2] ?? '2.1.2'
const SEED = +(process.argv[3] ?? 29)
const r = loadRelease(version)
const rand = rng(SEED)
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [x[i], x[j]] = [x[j], x[i]] } return x }
const pos = new Map(r.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const stratum = (q, e) => {
  const p = pos.get(q.questionId + '|' + e.entityId)
  if (!p) return 'sin_fila'
  if (!usable(p)) return 'ambigua_o_no_comparable'
  if (p.value === 0 || p.stanceStatus === 'conditional') return 'neutral_o_condicionada'
  if (p.value < 0) return 'negativa'
  return Math.abs(p.value) === 2 ? 'positiva_2' : 'positiva_1'
}
const regional = (q) => (q.regionalParties ?? []).length > 0
const qs = shuffle(r.questions.filter((q) => !regional(q)))
const cut = Math.round(qs.length * 0.4)
const devQ = new Set(qs.slice(0, cut).map((q) => q.questionId))
const cells = (qset) => r.questions.filter((q) => qset(q)).flatMap((q) => r.entities.filter((e) => !regional(q)).map((e) => ({ questionId: q.questionId, entityId: e.entityId, party: e.name, stratum: stratum(q, e) })))
const devCells = shuffle(cells((q) => devQ.has(q.questionId))), evalCells = shuffle(cells((q) => !regional(q) && !devQ.has(q.questionId)))
const take = (pool, plan, used = new Set()) => {
  const out = []
  for (const [s, n] of Object.entries(plan)) { const got = pool.filter((c) => c.stratum === s && !used.has(c.questionId + c.entityId)).slice(0, n); got.forEach((c) => used.add(c.questionId + c.entityId)); out.push(...got) }
  return out
}
const used = new Set()
const S = take(devCells, { positiva_2: 12, positiva_1: 8, negativa: 6, neutral_o_condicionada: 2, ambigua_o_no_comparable: 0, sin_fila: 12 }, used)
const D = take(devCells, { positiva_2: 15, positiva_1: 10, negativa: 10, neutral_o_condicionada: 3, ambigua_o_no_comparable: 2, sin_fila: 20 }, used)
const E = take(evalCells, { positiva_2: 35, positiva_1: 25, negativa: 25, neutral_o_condicionada: 10, ambigua_o_no_comparable: 5, sin_fila: 50 })
const disjoint = ![...S, ...D].some((c) => E.some((e) => e.questionId === c.questionId))
const sealed = crypto.createHash('sha256').update(JSON.stringify(E.map((c) => c.questionId + c.entityId))).digest('hex')
const count = (a) => a.reduce((m, c) => ((m[c.stratum] = (m[c.stratum] ?? 0) + 1), m), {})
const meta = { devQuestionIds: [...devQ], evalQuestionIds: qs.filter((q) => !devQ.has(q.questionId)).map((q) => q.questionId), release: version, sha256: r._sha256, seed: SEED, cutQuestionsDev: cut, S: S.length, D: D.length, E: E.length, questionsDisjointDevVsEval: disjoint, eSealedSha256: sealed, strataS: count(S), strataD: count(D), strataE: count(E), note: 'E es candidato al piloto humano y NO se usa para ajustar prompts ni elegir modelos. Preguntas regionales excluidas del reparto.' }
write('benchmark_split.json', { meta, S, D, E })
console.log(JSON.stringify(meta, null, 1))
