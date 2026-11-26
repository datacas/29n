// Fase 1 · Cobertura documental y reconciliación de denominadores (descriptivo, solo lectura).
// Cuenta celdas pregunta×partido por estado y relaciona la cobertura de cada partido con su afinidad media simulada.
import { loadRelease, usable, rng, write, pct } from './lib.mjs'

const version = process.argv[2] ?? '2.1.2'
const r = loadRelease(version)
const Q = r.questions, E = r.entities
const nameOf = Object.fromEntries(E.map((e) => [e.entityId, e.name]))
const total = Q.length * E.length
const rows = r.positions
const status = {}
for (const p of rows) status[p.stanceStatus] = (status[p.stanceStatus] ?? 0) + 1
const U = rows.filter(usable)

// Celdas estructuralmente no aplicables: pregunta regional × partido que no es de esa región.
const regionalOf = (q) => q.regionalParties ?? []
const inapplicable = new Set()
for (const q of Q) if (regionalOf(q).length) for (const e of E) if (!regionalOf(q).includes(e.name)) inapplicable.add(q.questionId + '|' + e.entityId)
const eligible = total - inapplicable.size
const codedEligible = rows.filter((p) => !inapplicable.has(p.questionId + '|' + p.entityId)).length
const usableEligible = U.filter((p) => !inapplicable.has(p.questionId + '|' + p.entityId)).length

const reconciliation = {
  release: version, sha256: r._sha256,
  cellsTotal: total, questions: Q.length, parties: E.length,
  rowsExported: rows.length, cellsWithoutRow: total - rows.length, cellsWithoutRowShare: +((total - rows.length) / total).toFixed(4),
  rowsByStatus: status,
  rowsUsableInScoring: U.length, rowsNotUsable: rows.length - U.length,
  cellsNotUsable: total - U.length, cellsNotUsableShare: +((total - U.length) / total).toFixed(4),
  structurallyInapplicableCells: inapplicable.size, eligibleCells: eligible,
  codedOfEligible: codedEligible, usableOfEligible: usableEligible,
  coverageOfEligible: +(usableEligible / eligible).toFixed(4),
  explanation: '2.774 = 146 preguntas × 19 partidos. 1.048 son filas exportadas (posiciones con algún estado); 1.726 celdas no tienen fila (62,2 %). De las 1.048 filas, 1.041 entran en el scoring (approved 1.029, conditional 11, explicit_neutral 1) y 7 no (ambiguous 5, not_comparable 2, sin valor). Por eso 1.048 y 1.041 son universos distintos: filas exportadas frente a filas utilizables. Las celdas no utilizables son 1.733 (62,5 %). Además, algunas celdas son estructuralmente no aplicables (pregunta regional × partido de otra región).'
}

const byParty = {}, byDim = {}, perQ = {}
for (const e of E) byParty[e.name] = { eligible: 0, coded: 0 }
for (const q of Q) {
  byDim[q.dimensionCode] ??= { eligible: 0, coded: 0 }
  for (const e of E) {
    if (inapplicable.has(q.questionId + '|' + e.entityId)) continue
    byParty[e.name].eligible++; byDim[q.dimensionCode].eligible++
  }
}
for (const p of U) {
  if (inapplicable.has(p.questionId + '|' + p.entityId)) continue
  byParty[nameOf[p.entityId]].coded++
  byDim[Q.find((q) => q.questionId === p.questionId).dimensionCode].coded++
  perQ[p.questionId] = (perQ[p.questionId] ?? 0) + 1
}
const fin = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, coverage: +(v.coded / v.eligible).toFixed(3) }]))
const qCov = Q.map((q) => perQ[q.questionId] ?? 0)
const hist = {}
for (const c of qCov) { const k = c === 0 ? '0' : c === 1 ? '1' : c === 2 ? '2' : c <= 5 ? '3-5' : c <= 9 ? '6-9' : '10+'; hist[k] = (hist[k] ?? 0) + 1 }

// Cobertura frente a afinidad: usuarios sintéticos, mismo modelo que sensibilidad.mjs.
const dimOf = Object.fromEntries(Q.map((q) => [q.questionId, q.dimensionCode]))
const holders = {}
for (const p of U) (holders[p.questionId] ??= new Set()).add(p.entityId)
const regional = new Set(Q.filter((q) => regionalOf(q).length).map((q) => q.questionId))
const pool = Q.filter((q) => !regional.has(q.questionId) && (holders[q.questionId]?.size ?? 0) >= 2).map((q) => q.questionId)
const byQ = {}
for (const p of U) (byQ[p.questionId] ??= []).push(p)
function affinity(ans) {
  const acc = {}
  for (const q of Object.keys(ans)) for (const p of byQ[q] ?? []) {
    const d = dimOf[q]; const o = ((acc[p.entityId] ??= {})[d] ??= { s: 0, n: 0 })
    o.s += 1 - Math.abs(ans[q] - p.value) / 4; o.n++
  }
  const out = {}
  for (const [e, dd] of Object.entries(acc)) { const m = Object.values(dd).map((o) => o.s / o.n); out[e] = (100 * m.reduce((a, b) => a + b, 0)) / m.length }
  return out
}
const rand = rng(29)
const sample = (arr, k) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, k) }
const N = 600
const prof = { aleatorio: () => Object.fromEntries(sample(pool, 32).map((q) => [q, [-2, -1, 1, 2][Math.floor(rand() * 4)]])), todo_mas2: () => Object.fromEntries(sample(pool, 32).map((q) => [q, 2])), todo_menos2: () => Object.fromEntries(sample(pool, 32).map((q) => [q, -2])) }
const spearman = (xs, ys) => { const rk = (a) => { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(a.length); s.forEach(([, i], k) => (r[i] = k + 1)); return r }; const a = rk(xs), b = rk(ys); const n = a.length; const ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2 } return c / Math.sqrt(va * vb) }
const relation = {}
const posShare = {}
for (const e of E) { const mine = U.filter((p) => p.entityId === e.entityId); posShare[e.entityId] = mine.filter((p) => p.value > 0).length / (mine.length || 1) }
const abs2 = {}
for (const e of E) { const mine = U.filter((p) => p.entityId === e.entityId); abs2[e.entityId] = mine.filter((p) => Math.abs(p.value) === 2).length / (mine.length || 1) }
const covParty = E.map((e) => byParty[e.name].coded / byParty[e.name].eligible)
for (const [k, f] of Object.entries(prof)) {
  const sum = Object.fromEntries(E.map((e) => [e.entityId, 0])), cnt = { ...sum }, top = { ...sum }
  for (let u = 0; u < N; u++) { const s = affinity(f()); const best = Object.entries(s).sort((a, b) => b[1] - a[1])[0]; if (best) top[best[0]]++; for (const [e, v] of Object.entries(s)) { sum[e] += v; cnt[e]++ } }
  const mean = E.map((e) => (cnt[e.entityId] ? sum[e.entityId] / cnt[e.entityId] : 0))
  relation[k] = { spearmanCoverageVsMeanAffinity: +spearman(covParty, mean).toFixed(2), spearmanPositiveShareVsMeanAffinity: +spearman(E.map((e) => posShare[e.entityId]), mean).toFixed(2), spearmanShareOfPlusMinus2VsMeanAffinity: +spearman(E.map((e) => abs2[e.entityId]), mean).toFixed(2), meanAffinityByParty: Object.fromEntries(E.map((e, i) => [e.name, +mean[i].toFixed(1)])), topShareByParty: Object.fromEntries(E.map((e) => [e.name, +(top[e.entityId] / N).toFixed(3)])) }
}
const out = { reconciliation, byParty: fin(byParty), byDimension: fin(byDim), questionCoverageHistogram: hist, relationCoverageAffinity: relation, note: 'Usuarios sintéticos (semilla 29). Correlaciones de rango entre 19 partidos: asociación, no causalidad.' }
write('cobertura.json', out)
write('cobertura.md', `# Cobertura documental y reconciliación — release ${version}\n\n${reconciliation.explanation}\n\n| Concepto | Celdas |\n|---|---|\n| Total (146 × 19) | ${total} |\n| Sin fila | ${reconciliation.cellsWithoutRow} (${pct(reconciliation.cellsWithoutRowShare, 1)}) |\n| Filas exportadas | ${rows.length} |\n| — utilizables en el scoring | ${U.length} |\n| — no utilizables (ambiguous/not_comparable) | ${rows.length - U.length} |\n| No utilizables en total | ${reconciliation.cellsNotUsable} (${pct(reconciliation.cellsNotUsableShare, 1)}) |\n| Estructuralmente no aplicables | ${inapplicable.size} |\n| Cobertura sobre celdas aplicables | ${pct(reconciliation.coverageOfEligible, 1)} |\n\n## Cobertura por partido (utilizables / aplicables)\n| Partido | Cobertura |\n|---|---|\n${Object.entries(fin(byParty)).sort((a, b) => b[1].coverage - a[1].coverage).map(([k, v]) => `| ${k} | ${v.coded}/${v.eligible} (${pct(v.coverage)}) |`).join('\n')}\n\n## Cobertura por dimensión\n| Dimensión | Cobertura |\n|---|---|\n${Object.entries(fin(byDim)).map(([k, v]) => `| ${k} | ${v.coded}/${v.eligible} (${pct(v.coverage)}) |`).join('\n')}\n\n## Partidos con posición por pregunta\n${Object.entries(hist).map(([k, v]) => `- ${k} partidos: ${v} preguntas`).join('\n')}\n\n## Cobertura frente a afinidad (usuarios sintéticos, ${N} por perfil)\n${Object.entries(relation).map(([k, v]) => `- **${k}**: Spearman cobertura–afinidad media = ${v.spearmanCoverageVsMeanAffinity}; % positivas–afinidad media = ${v.spearmanPositiveShareVsMeanAffinity}; % de codificaciones ±2–afinidad media = ${v.spearmanShareOfPlusMinus2VsMeanAffinity}`).join('\n')}\n\nAsociación entre 19 partidos, no causalidad. Con respuestas simétricas al azar, la proximidad media de un partido depende de la intensidad de sus codificaciones (los ±1 quedan más cerca de todas las respuestas que los ±2), no de su signo: la relación con el % de positivas es un proxy.\n`)
console.log(JSON.stringify(reconciliation, null, 1).slice(0, 1400)); console.log(JSON.stringify(Object.fromEntries(Object.entries(relation).map(([k, v]) => [k, [v.spearmanCoverageVsMeanAffinity, v.spearmanPositiveShareVsMeanAffinity]]))), JSON.stringify(hist))
