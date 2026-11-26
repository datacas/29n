// Genera conjuntos de datos reproducibles y los resultados de la implementación propia para contrastarlos con librerías externas.
import fs from 'node:fs'
import { rng } from '../lib.mjs'
import { krippendorffAlpha, weightedKappa, gwetAC } from '../agreement.mjs'
const N = null, r = rng(2911)
const classic = { name: 'ejemplo_15_unidades_4_evaluadores', cats: [1, 2, 3, 4, 5], units: [[1,1,N,1],[2,2,3,2],[3,3,3,3],[3,3,3,3],[2,2,2,2],[1,2,3,4],[4,4,4,4],[1,1,2,1],[2,2,2,2],[N,5,5,5],[N,N,1,1],[N,3,N,N],[3,N,3,N],[3,3,3,3],[3,4,4,N]] }
const gen = (name, nU, nR, cats, pMiss, probs) => ({ name, cats, units: Array.from({ length: nU }, () => Array.from({ length: nR }, () => { if (r() < pMiss) return null; let x = r(), a = 0; for (let k = 0; k < cats.length; k++) { a += probs[k]; if (x < a) return cats[k] } return cats[cats.length - 1] })) })
const ord = [-2, -1, 1, 2]
const sets = [
  classic,
  gen('ordinal_4_evaluadores_20pct_ausentes', 200, 4, ord, 0.2, [0.15, 0.2, 0.35, 0.3]),
  gen('ordinal_sesgado_90pct_en_2', 200, 3, ord, 0.1, [0.02, 0.03, 0.05, 0.9]),
  gen('ordinal_2_evaluadores_completo', 150, 2, ord, 0, [0.25, 0.25, 0.25, 0.25]),
  gen('nominal_5_clases_3_evaluadores', 120, 3, ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous'], 0.15, [0.4, 0.1, 0.02, 0.4, 0.08]),
  { name: 'degenerado_sin_variacion', cats: ord, units: Array.from({ length: 20 }, () => [2, 2, 2]) },
]
const full = [-2, -1, 0, 1, 2]
const out = sets.map((s) => { const catsAC = s.cats.every((c) => typeof c === 'number') && s.cats.some((c) => c === -2) ? full : s.cats; s.catsAC = catsAC; const num = s.cats.every((c) => typeof c === 'number'); const res = { name: s.name, cats: s.cats, catsAC, units: s.units, js: { nominal: krippendorffAlpha(s.units, 'nominal'), ordinal: num ? krippendorffAlpha(s.units, 'ordinal') : null, interval: num ? krippendorffAlpha(s.units, 'interval') : null, ac1: gwetAC(s.units, catsAC, 'none'), ac2_lineal: num ? gwetAC(s.units, catsAC, 'linear') : null, ac2_cuadratica: num ? gwetAC(s.units, catsAC, 'quadratic') : null } }
  if (s.units[0].length === 2 && !s.units.some((u) => u.includes(null))) { const a = s.units.map((u) => u[0]), b = s.units.map((u) => u[1]); res.js.kappa_lineal = weightedKappa(a, b, catsAC, 'linear'); res.js.kappa_cuadratico = weightedKappa(a, b, catsAC, 'quadratic'); res.js.kappa_sin_ponderar = weightedKappa(a, b, catsAC, 'none') }
  return res })
fs.writeFileSync(new URL('../../../docs/methodology/local/out/verify_external.json', import.meta.url), JSON.stringify(out))
console.log('conjuntos:', out.length)
