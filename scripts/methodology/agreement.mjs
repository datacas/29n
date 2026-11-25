// Métricas de concordancia entre evaluadores (puras, sin dependencias). Documentación de cada elección en el issue #49.
// Valores ausentes: null/undefined. Unidad de análisis: celda pregunta×partido (fila) × evaluador (columna).
import { rng } from './lib.mjs'

/** Alfa de Krippendorff. `units`: array de arrays de valoraciones (null = ausente). metric: nominal | interval | ordinal. */
export function krippendorffAlpha(units, metric = 'nominal') {
  const vals = [...new Set(units.flat().filter((v) => v !== null && v !== undefined))].sort((a, b) => a - b)
  const idx = new Map(vals.map((v, i) => [v, i])); const C = vals.length
  const o = Array.from({ length: C }, () => Array(C).fill(0))
  for (const u of units) {
    const x = u.filter((v) => v !== null && v !== undefined); const m = x.length; if (m < 2) continue
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) o[idx.get(x[i])][idx.get(x[j])] += 1 / (m - 1)
  }
  const nc = o.map((row) => row.reduce((a, b) => a + b, 0)); const n = nc.reduce((a, b) => a + b, 0)
  if (n <= 1 || C < 2) return NaN
  const d2 = (c, k) => {
    if (c === k) return 0
    if (metric === 'nominal') return 1
    if (metric === 'interval') return (vals[c] - vals[k]) ** 2
    const [a, b] = c < k ? [c, k] : [k, c]; let s = 0; for (let g = a; g <= b; g++) s += nc[g]; return (s - (nc[a] + nc[b]) / 2) ** 2
  }
  let Do = 0, De = 0
  for (let c = 0; c < C; c++) for (let k = 0; k < C; k++) { Do += o[c][k] * d2(c, k); De += nc[c] * nc[k] * d2(c, k) }
  if (De === 0) return NaN   // sin variación: el coeficiente no está definido
  return 1 - ((n - 1) * Do) / De
}
/** IC por bootstrap de unidades (semilla fija). */
export function alphaCI(units, metric = 'nominal', B = 1000, seed = 29) {
  const rand = rng(seed); const est = []
  for (let b = 0; b < B; b++) { const s = Array.from({ length: units.length }, () => units[Math.floor(rand() * units.length)]); const a = krippendorffAlpha(s, metric); if (!Number.isNaN(a)) est.push(a) }
  est.sort((x, y) => x - y)
  return { alpha: krippendorffAlpha(units, metric), lo: est[Math.floor(0.025 * est.length)] ?? NaN, hi: est[Math.floor(0.975 * est.length)] ?? NaN, validBootstraps: est.length }
}
/** Kappa de Cohen ponderado para dos evaluadores. weights: none | linear | quadratic. r1 y r2: arrays emparejados (sin ausentes). */
export function weightedKappa(r1, r2, categories, weights = 'quadratic') {
  const q = categories.length, ix = new Map(categories.map((c, i) => [c, i])); const n = r1.length
  const w = (i, j) => (weights === 'none' ? (i === j ? 1 : 0) : weights === 'linear' ? 1 - Math.abs(i - j) / (q - 1) : 1 - ((i - j) / (q - 1)) ** 2)
  const obs = Array.from({ length: q }, () => Array(q).fill(0)); r1.forEach((a, k) => obs[ix.get(a)][ix.get(r2[k])]++)
  const m1 = obs.map((row) => row.reduce((a, b) => a + b, 0) / n), m2 = Array.from({ length: q }, (_, j) => obs.reduce((a, row) => a + row[j], 0) / n)
  let po = 0, pe = 0; for (let i = 0; i < q; i++) for (let j = 0; j < q; j++) { po += (w(i, j) * obs[i][j]) / n; pe += w(i, j) * m1[i] * m2[j] }
  return pe === 1 ? NaN : (po - pe) / (1 - pe)
}
/** Gwet AC1/AC2: varios evaluadores, ausentes permitidos. weights: none (AC1) | linear | quadratic (AC2). `units` como en Krippendorff. */
export function gwetAC(units, categories, weights = 'quadratic') {
  const q = categories.length, ix = new Map(categories.map((c, i) => [c, i]))
  const w = (i, j) => (weights === 'none' ? (i === j ? 1 : 0) : weights === 'linear' ? 1 - Math.abs(i - j) / (q - 1) : 1 - ((i - j) / (q - 1)) ** 2)
  let Tw = 0; for (let i = 0; i < q; i++) for (let j = 0; j < q; j++) Tw += w(i, j)
  // Gwet (2014): el acuerdo observado usa las unidades con ≥2 evaluadores; las proporciones marginales π_k, las unidades con ≥1.
  const pi = Array(q).fill(0); let pa = 0, used = 0, usedPi = 0
  for (const u of units) {
    const x = u.filter((v) => v !== null && v !== undefined); const r = x.length; if (r < 1) continue
    const cnt = Array(q).fill(0); x.forEach((v) => cnt[ix.get(v)]++)
    cnt.forEach((c, k) => (pi[k] += c / r)); usedPi++
    if (r < 2) continue
    let s = 0; for (let k = 0; k < q; k++) { let rs = 0; for (let l = 0; l < q; l++) rs += w(k, l) * cnt[l]; s += (cnt[k] * (rs - 1)) / (r * (r - 1)) }
    pa += s; used++
  }
  if (!used) return NaN
  pa /= used; pi.forEach((_, k) => (pi[k] /= usedPi))
  const pe = (Tw / (q * (q - 1))) * pi.reduce((a, p) => a + p * (1 - p), 0)
  return pe === 1 ? NaN : (pa - pe) / (1 - pe)
}
