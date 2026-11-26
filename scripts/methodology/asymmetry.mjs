// Fase 0 · Asimetría de la codificación (descriptivo, solo lectura).
// Cuantifica el reparto de signos por partido, dimensión y tema y la capacidad discriminativa de cada ítem.
// NO atribuye causas: la atribución requiere la segunda codificación (fase 1).
import { loadRelease, usable, write, pct } from './lib.mjs'

const version = process.argv[2] ?? '2.1.2'
const r = loadRelease(version)
const Q = r.questions
const qd = Object.fromEntries(Q.map((q) => [q.questionId, q]))
const U = r.positions.filter(usable)
const sign = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero')
const bucket = (m, k, v) => { const o = (m[k] ??= { n: 0, pos: 0, neg: 0, zero: 0, abs2: 0 }); o.n++; o[sign(v)]++; if (Math.abs(v) === 2) o.abs2++ }

const byParty = {}, byDim = {}, byTheme = {}
for (const p of U) {
  bucket(byParty, r.partyName(p.entityId), p.value)
  bucket(byDim, qd[p.questionId].dimensionCode, p.value)
  bucket(byTheme, qd[p.questionId].themeCode ?? '—', p.value)
}
const fin = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, posShare: +(v.pos / v.n).toFixed(3), abs2Share: +(v.abs2 / v.n).toFixed(3) }]))

// por pregunta
const perQ = {}
for (const p of U) (perQ[p.questionId] ??= []).push(p.value)
const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }
const items = Q.map((q, i) => {
  const v = perQ[q.questionId] ?? []
  return { n: i + 1, questionId: q.questionId, dim: q.dimensionCode, parties: v.length, allPositive: v.length >= 3 && v.every((x) => x > 0), anyNegative: v.some((x) => x < 0), sd: v.length >= 2 ? +sd(v).toFixed(2) : null }
})
const evaluable = items.filter((i) => i.parties >= 3)
const summary = {
  release: version, sha256: r._sha256,
  cells: Q.length * r.entities.length, coded: r.positions.length, usable: U.length,
  notCoded: Q.length * r.entities.length - r.positions.length,
  positiveShare: +(U.filter((p) => p.value > 0).length / U.length).toFixed(3),
  questionsWith3PlusParties: evaluable.length,
  allPositive: evaluable.filter((i) => i.allPositive).length,
  withAnyNegative: evaluable.filter((i) => i.anyNegative).length,
  lowDiscrimination_sdLt05: evaluable.filter((i) => i.sd < 0.5).length,
  questionsWithAnyNegativeShare: +(evaluable.filter((i) => i.anyNegative).length / evaluable.length).toFixed(3),
}
// ¿cuántas preguntas están en el selector con al menos una posición negativa? y por dimensión
const dimNeg = {}
for (const i of evaluable) { const o = (dimNeg[i.dim] ??= { questions: 0, withNegative: 0 }); o.questions++; if (i.anyNegative) o.withNegative++ }

write('asimetria.json', { summary, byParty: fin(byParty), byDimension: fin(byDim), byTheme: fin(byTheme), dimensionsNegativeCoverage: dimNeg, items })
const rows = (o) => Object.entries(fin(o)).sort((a, b) => b[1].posShare - a[1].posShare).map(([k, v]) => `| ${k} | ${v.n} | ${pct(v.posShare)} | ${pct(v.abs2Share)} |`).join('\n')
write('asimetria.md', `# Asimetría de la codificación — release ${version}\n\nGenerado por \`scripts/methodology/asymmetry.mjs\` (sha256 del release: \`${r._sha256.slice(0, 12)}…\`). Descriptivo: no atribuye causas.\n\n- Celdas pregunta×partido: ${summary.cells}; codificadas: ${summary.coded}; con valor utilizable: ${summary.usable}; sin posición: ${summary.notCoded} (${pct(summary.notCoded / summary.cells)}).\n- Posiciones positivas: ${pct(summary.positiveShare)}.\n- De ${summary.questionsWith3PlusParties} preguntas con ≥3 partidos codificados: ${summary.allPositive} sin ninguna posición negativa; ${summary.lowDiscrimination_sdLt05} con desviación típica <0,5.\n\n## Por partido\n| Partido | n | % positivas | % ±2 |\n|---|---|---|---|\n${rows(byParty)}\n\n## Por dimensión\n| Dimensión | n | % positivas | % ±2 |\n|---|---|---|---|\n${rows(byDim)}\n\n## Preguntas con alguna posición negativa, por dimensión\n| Dimensión | Preguntas (≥3 partidos) | Con alguna negativa |\n|---|---|---|\n${Object.entries(dimNeg).map(([k, v]) => `| ${k} | ${v.questions} | ${v.withNegative} |`).join('\n')}\n`)
console.log(JSON.stringify(summary, null, 1))
