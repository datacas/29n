// Muestreo estratificado sistemático y estimadores con pesos de diseño (puro, determinista, sin dependencias). Usado por el diseño de la campaña humana de ~150 celdas.
import { rng } from '../../app/lib/methodology/agreement.ts'

/** Selección sistemática dentro de un estrato ya ORDENADO (estratificación implícita). Devuelve los índices elegidos y el siguiente índice libre de cada uno (reemplazo SOLO por invalidez técnica). */
export function systematic(N, n, seed) {
  if (n > N) throw new Error(`n (${n}) > N (${N})`)
  if (n === N) return Array.from({ length: N }, (_, i) => i)
  const k = N / n; const start = rng(seed)() * k; const idx = []
  for (let i = 0; i < n; i++) idx.push(Math.min(N - 1, Math.floor(start + i * k)))
  return idx
}

/** Para cada elegido, su reemplazo predefinido: el siguiente índice del estrato no elegido (circular). Se usa únicamente si la celda es técnicamente inválida (nunca por dificultad o resultado). */
export function replacements(N, chosen) {
  const taken = new Set(chosen); const out = {}
  for (const i of chosen) { let j = (i + 1) % N, guard = 0; while (taken.has(j) && guard++ < N) j = (j + 1) % N; out[i] = taken.has(j) ? null : j }
  return out
}

/** Probabilidad de inclusión y peso de diseño de un estrato: π = n/N, w = N/n. */
export const inclusion = (N, n) => ({ pi: n / N, weight: N / n })

/**
 * Proporción estimada de una muestra estratificada con pesos: p̂ = Σ W_h p̂_h, W_h = N_h / N; varianza Σ W_h² (1 − f_h) p̂_h (1 − p̂_h) / (n_h − 1) (con corrección de población finita).
 * strata: [{ N, n, x }] con x = número de «éxitos» observados. IC: normal sobre la escala logit (más estable cerca de 0 y 1). NO es el IC de una muestra aleatoria simple.
 */
export function stratifiedProportion(strata, z = 1.96) {
  const Ntot = strata.reduce((s, h) => s + h.N, 0)
  let p = 0, v = 0
  for (const h of strata) { const W = h.N / Ntot, ph = h.x / h.n; p += W * ph; if (h.n > 1 && h.n < h.N) v += W * W * (1 - h.n / h.N) * ph * (1 - ph) / (h.n - 1) }
  const se = Math.sqrt(v)
  let lo = Math.max(0, p - z * se), hi = Math.min(1, p + z * se)
  if (p > 0 && p < 1 && se > 0) { const l = Math.log(p / (1 - p)), s = se / (p * (1 - p)); lo = 1 / (1 + Math.exp(-(l - z * s))); hi = 1 / (1 + Math.exp(-(l + z * s))) }
  return { p, se, lo, hi, nTotal: strata.reduce((s, h) => s + h.n, 0), N: Ntot }
}

/** Tamaño de muestra efectivo de Kish por los pesos (n_eff = (Σw)² / Σw²): lo que «vale» la muestra con pesos desiguales. */
export function kishNeff(weights) { const s = weights.reduce((a, b) => a + b, 0), s2 = weights.reduce((a, b) => a + b * b, 0); return s2 ? (s * s) / s2 : 0 }
