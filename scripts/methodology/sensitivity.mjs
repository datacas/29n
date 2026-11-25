// Fase 0 · Sensibilidad y estabilidad del ranking (simulación reproducible, solo lectura).
// Réplica fiel de la fórmula de app/lib/scoring/calculate.ts: proximidad = 1 − |u − p| / 4, media ponderada por
// dimensión y media entre dimensiones (λ iguales o de calibración renormalizadas entre las dimensiones evaluables).
// Los usuarios son SINTÉTICOS y se generan con semilla fija. No sustituyen a usuarios reales.
import { loadRelease, usable, rng, write, pct } from './lib.mjs'

const version = process.argv[2] ?? '2.1.2'
const SEED = +(process.argv[3] ?? 29)
const N = +(process.argv[4] ?? 400)
const r = loadRelease(version)
const Q = r.questions
const qd = Object.fromEntries(Q.map((q) => [q.questionId, q]))
const DIMS = [...new Set(Q.map((q) => q.dimensionCode))].sort()
const ents = r.entities.map((e) => e.entityId)
const regional = new Set(Q.filter((q) => q.regionalParties?.length).map((q) => q.questionId))
const base = r.positions.filter(usable)
const holders = {}
for (const p of base) (holders[p.questionId] ??= new Set()).add(p.entityId)
const pool = Q.filter((q) => !regional.has(q.questionId) && (holders[q.questionId]?.size ?? 0) >= 2).map((q) => q.questionId)
const clip = (v) => Math.max(-2, Math.min(2, v))

function score(ans, P, lambda) {
  const acc = {}
  for (const p of P) {
    if (!(p.questionId in ans)) continue
    const d = qd[p.questionId].dimensionCode
    const w = (acc[p.entityId] ??= {})
    const o = (w[d] ??= { s: 0, n: 0 })
    o.s += 1 - Math.abs(ans[p.questionId] - p.value) / 4
    o.n++
  }
  const out = {}
  for (const e of ents) {
    const dd = acc[e]
    if (!dd) { out[e] = null; continue }
    const ks = Object.keys(dd)
    const lam = (k) => (lambda ? lambda[k] : 1)
    const tot = ks.reduce((a, k) => a + lam(k), 0)
    out[e] = (100 * ks.reduce((a, k) => a + lam(k) * (dd[k].s / dd[k].n), 0)) / tot
  }
  return out
}
const rank = (s) => ents.filter((e) => s[e] !== null).sort((a, b) => s[b] - s[a] || (a < b ? -1 : 1))
function tau(a, b) {
  const m = a.filter((x) => b.includes(x)); let c = 0, d = 0
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) (b.indexOf(m[i]) < b.indexOf(m[j]) ? c++ : d++)
  return c + d ? (c - d) / (c + d) : 1
}
const sample = (rand, arr, k) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, k) }
const byParty = {}
for (const p of base) (byParty[p.entityId] ??= {})[p.questionId] = p.value

// ---- arquetipos de usuario sintético -------------------------------------------------------------
const ARCH = {
  aleatorio: (rand, k) => Object.fromEntries(sample(rand, pool, k).map((q) => [q, [-2, -1, 1, 2][Math.floor(rand() * 4)]])),
  // Coherente: responde como un partido codificado (con ruido ±1 en el 15 % de las respuestas).
  coherente_partido: (rand, k) => {
    const e = ents[Math.floor(rand() * ents.length)]; const own = Object.keys(byParty[e] ?? {}).filter((q) => pool.includes(q))
    return Object.fromEntries(sample(rand, own, Math.min(k, own.length)).map((q) => [q, clip(byParty[e][q] + (rand() < 0.15 ? (rand() < 0.5 ? -1 : 1) : 0))]))
  },
  // Heterogéneo: cada dimensión la responde como un partido distinto.
  heterogeneo_dimensiones: (rand, k) => {
    const who = Object.fromEntries(DIMS.map((d) => [d, ents[Math.floor(rand() * ents.length)]]))
    const cand = pool.filter((q) => byParty[who[qd[q].dimensionCode]]?.[q] !== undefined)
    return Object.fromEntries(sample(rand, cand, Math.min(k, cand.length)).map((q) => [q, byParty[who[qd[q].dimensionCode]][q]]))
  },
  // Predominantemente neutral: «No sé» en casi todo (solo responde 8 preguntas, valores ±1).
  casi_neutral: (rand) => Object.fromEntries(sample(rand, pool, 8).map((q) => [q, rand() < 0.5 ? -1 : 1])),
  acquiescente_mas2: (rand, k) => Object.fromEntries(sample(rand, pool, k).map((q) => [q, 2])),
  rechaza_todo_menos2: (rand, k) => Object.fromEntries(sample(rand, pool, k).map((q) => [q, -2])),
}
// Ponderaciones de dimensión: iguales o extremas (una dimensión al 70 %).
const lambdaFor = (rand, mode) => {
  if (mode === 'iguales') return null
  const d = DIMS[Math.floor(rand() * DIMS.length)]
  return Object.fromEntries(DIMS.map((k) => [k, k === d ? 0.7 : 0.3 / (DIMS.length - 1)]))
}
// Perturbaciones de la codificación.
const PERT = {
  sim_10: (rand) => base.map((p) => (rand() < 0.1 ? { ...p, value: clip(p.value + (rand() < 0.5 ? -1 : 1)) } : p)),
  sim_20: (rand) => base.map((p) => (rand() < 0.2 ? { ...p, value: clip(p.value + (rand() < 0.5 ? -1 : 1)) } : p)),
  suavizado_20: (rand) => base.map((p) => (rand() < 0.2 && p.value !== 0 ? { ...p, value: p.value - Math.sign(p.value) } : p)),
  intensifica_20: (rand) => base.map((p) => (rand() < 0.2 && p.value !== 0 ? { ...p, value: clip(p.value + Math.sign(p.value)) } : p)),
  signo_5: (rand) => base.map((p) => (rand() < 0.05 ? { ...p, value: -p.value } : p)),
  excluye_10: (rand) => base.filter(() => rand() >= 0.1),
}

function run(arch, pert, mode, k = 32) {
  const rand = rng(SEED * 1000 + arch.length * 31 + pert.length * 17 + mode.length)
  let top1 = 0, top3 = 0, tauSum = 0, close = 0, gapSum = 0, rankShift = 0, n = 0
  for (let u = 0; u < N; u++) {
    const ans = ARCH[arch](rand, k); if (Object.keys(ans).length < 5) continue
    const lam = lambdaFor(rand, mode)
    const s0 = score(ans, base, lam); const r0 = rank(s0)
    const P = PERT[pert](rand); const s1 = score(ans, P, lam); const r1 = rank(s1)
    if (r0.length < 3 || r1.length < 3) continue
    n++
    if (r0[0] === r1[0]) top1++
    if (r0.slice(0, 3).every((x) => r1.slice(0, 3).includes(x))) top3++
    tauSum += tau(r0, r1)
    const gap = s0[r0[0]] - s0[r0[1]]; gapSum += gap; if (gap < 3) close++
    rankShift += r0.reduce((a, e, i) => a + Math.abs(i - r1.indexOf(e)), 0) / r0.length
  }
  return { arch, pert, lambda: mode, users: n, top1Stable: +(top1 / n).toFixed(3), top3SetStable: +(top3 / n).toFixed(3), tauMean: +(tauSum / n).toFixed(3), meanRankShift: +(rankShift / n).toFixed(2), gap12Mean: +(gapSum / n).toFixed(1), gapLt3pts: +(close / n).toFixed(3) }
}

const results = []
for (const arch of Object.keys(ARCH)) for (const pert of ['sim_10', 'sim_20', 'suavizado_20', 'signo_5', 'excluye_10']) results.push(run(arch, pert, 'iguales'))
for (const pert of ['sim_20']) for (const arch of ['aleatorio', 'coherente_partido']) results.push(run(arch, pert, 'extremas'))
// profundidad: 16 / 32 / 56 preguntas con arquetipo aleatorio
const depth = [16, 32, 56].map((k) => ({ k, ...run('aleatorio', 'sim_10', 'iguales', k) }))

// Influencia de cada pregunta: ¿cuántas veces cambia el primero al quitarla? (usuarios coherentes + aleatorios)
const infl = {}
{
  const rand = rng(SEED + 7)
  for (let u = 0; u < Math.min(N, 200); u++) {
    const ans = (u % 2 ? ARCH.aleatorio : ARCH.coherente_partido)(rand, 32)
    const t = rank(score(ans, base, null))[0]
    for (const q of Object.keys(ans)) { const a2 = { ...ans }; delete a2[q]; const o = (infl[q] ??= { present: 0, flips: 0 }); o.present++; if (rank(score(a2, base, null))[0] !== t) o.flips++ }
  }
}
const inflList = Object.entries(infl).filter(([, o]) => o.present >= 10).map(([q, o]) => ({ n: Q.findIndex((x) => x.questionId === q) + 1, text: qd[q].canonicalText, dim: qd[q].dimensionCode, flipRate: +(o.flips / o.present).toFixed(3), present: o.present })).sort((a, b) => b.flipRate - a.flipRate)
const flipAll = Object.values(infl).reduce((a, o) => a + o.flips, 0) / Object.values(infl).reduce((a, o) => a + o.present, 0)

// Efecto máximo de dividir una pregunta (duplicar su peso en una dimensión): duplica la posición de cada partido.
const splitFx = []
{
  const rand = rng(SEED + 99); const probe = sample(rand, pool, 30)
  for (const q of probe) {
    let ch = 0, n = 0
    const dupId = q + '#2'; qd[dupId] = qd[q]
    const P2 = [...base, ...base.filter((p) => p.questionId === q).map((p) => ({ ...p, questionId: dupId }))]
    for (let u = 0; u < 150; u++) {
      const ans = ARCH.aleatorio(rand, 32); if (!(q in ans)) ans[q] = [-2, -1, 1, 2][Math.floor(rand() * 4)]
      const a2 = { ...ans, [dupId]: ans[q] }
      n++; if (rank(score(ans, base, null))[0] !== rank(score(a2, P2, null))[0]) ch++
    }
    splitFx.push({ n: Q.findIndex((x) => x.questionId === q) + 1, topChanges: +(ch / n).toFixed(3) })
  }
}
const splitMean = splitFx.reduce((a, x) => a + x.topChanges, 0) / splitFx.length

const meta = { release: version, sha256: r._sha256, seed: SEED, usersPerScenario: N, scoringModel: r.scoringModelVersion, poolQuestions: pool.length, generatedBy: 'scripts/methodology/sensitivity.mjs', note: 'Usuarios sintéticos; NO son usuarios reales. Perturbaciones: sim_k = k % de posiciones ±1; suavizado = acercar a 0; signo_5 = 5 % con signo invertido; excluye_10 = 10 % de posiciones fuera del cálculo.' }
write('sensibilidad.json', { meta, results, depth, influence: { meanFlipRateOnRemovingOneQuestion: +flipAll.toFixed(3), top15: inflList.slice(0, 15) }, splitDuplication: { meanTopChange: +splitMean.toFixed(3), maxTopChange: Math.max(...splitFx.map((x) => x.topChanges)), probes: splitFx } })
const md = `# Sensibilidad del ranking — release ${version}\n\nGenerado por \`scripts/methodology/sensitivity.mjs\` (semilla ${SEED}, ${N} usuarios por escenario, sha256 \`${r._sha256.slice(0, 12)}…\`). **Usuarios sintéticos: ilustra la sensibilidad del modelo, no mide a votantes reales.**\n\n| Arquetipo | Perturbación | λ dim. | 1.º estable | Top-3 (conjunto) | τ medio | Hueco 1.º–2.º <3 pts |\n|---|---|---|---|---|---|---|\n${results.map((x) => `| ${x.arch} | ${x.pert} | ${x.lambda} | ${pct(x.top1Stable)} | ${pct(x.top3SetStable)} | ${x.tauMean} | ${pct(x.gapLt3pts)} |`).join('\n')}\n\n## Profundidad (aleatorio, sim_10)\n${depth.map((x) => `- ${x.k} preguntas: 1.º estable ${pct(x.top1Stable)}, hueco <3 pts ${pct(x.gapLt3pts)}`).join('\n')}\n\n## Influencia de una pregunta\nQuitar una sola pregunta cambia el primer partido en el ${pct(flipAll, 1)} de los casos (media). Las 15 más influyentes están en \`sensibilidad.json\`.\n\n## Efecto máximo de dividir una pregunta (duplicar su peso)\nDuplicar una pregunta al azar cambia el primer partido en el ${pct(splitMean, 1)} de los usuarios simulados (máximo ${pct(Math.max(...splitFx.map((x) => x.topChanges)), 1)} en las 30 probadas). Es una **cota superior**: las dos mitades reales tendrán posiciones distintas y el selector no repite tema en los modos rápido y normal.\n`
write('sensibilidad.md', md)
console.log(md)
