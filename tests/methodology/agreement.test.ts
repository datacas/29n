import { describe, it, expect } from 'vitest'
// @ts-expect-error módulo .mjs sin tipos
import { krippendorffAlpha, weightedKappa, gwetAC, alphaCI } from '../../scripts/methodology/agreement.mjs'

// Conjunto de 4 evaluadores, 15 unidades y datos ausentes. Los valores esperados NO proceden de la literatura (de memoria no pude
// reproducir las cifras publicadas del ejemplo clásico): se obtuvieron con un cálculo independiente por pares directos
// (python, sin matriz de coincidencias) y coinciden con esta implementación.
const N = null
const A = [1, 2, 3, 3, 2, 1, 4, 1, 2, N, N, N, 3, 3, 3]
const B = [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, N, 3, N, 3, 4]
const C = [N, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, N, 3, 3, 4]
const D = [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, N, N, 3, N]
const units = A.map((_, i) => [A[i], B[i], C[i], D[i]])

describe('alfa de Krippendorff', () => {
  it('coincide con un cálculo independiente por pares (nominal 0,7339; ordinal 0,8278; intervalo 0,8457)', () => {
    expect(krippendorffAlpha(units, 'nominal')).toBeCloseTo(0.7339, 3)
    expect(krippendorffAlpha(units, 'ordinal')).toBeCloseTo(0.8278, 3)
    expect(krippendorffAlpha(units, 'interval')).toBeCloseTo(0.8457, 3)
  })
  it('acuerdo perfecto = 1 y sin variación = indefinido', () => {
    expect(krippendorffAlpha([[1, 1], [2, 2], [3, 3]], 'ordinal')).toBeCloseTo(1, 10)
    expect(krippendorffAlpha([[2, 2], [2, 2]], 'ordinal')).toBeNaN()
  })
  it('puede ser negativo con desacuerdo sistemático', () => {
    expect(krippendorffAlpha([[1, 2], [2, 1], [1, 2], [2, 1]], 'nominal')).toBeLessThan(0)
  })
  it('un desacuerdo de signo pesa más que uno de intensidad en la métrica ordinal', () => {
    const base = [[-2, -2], [-1, -1], [1, 1], [2, 2], [1, 1], [-1, -1], [2, 2], [-2, -2]]
    const intensidad = [...base.slice(0, 6), [2, 1], [-2, -1]]
    const signo = [...base.slice(0, 6), [2, -2], [-2, 2]]
    expect(krippendorffAlpha(intensidad, 'ordinal')).toBeGreaterThan(krippendorffAlpha(signo, 'ordinal'))
  })
  it('el IC por bootstrap es reproducible', () => {
    const a = alphaCI(units, 'nominal', 200, 7), b = alphaCI(units, 'nominal', 200, 7)
    expect(a).toEqual(b); expect(a.lo).toBeLessThanOrEqual(a.alpha); expect(a.hi).toBeGreaterThanOrEqual(a.alpha)
  })
})
describe('kappa ponderado', () => {
  it('sin ponderar coincide con el kappa de Cohen (tabla 2×2 [[20,5],[10,15]] → 0,4)', () => {
    const r1: number[] = [], r2: number[] = []
    const push = (a: number, b: number, n: number) => { for (let i = 0; i < n; i++) { r1.push(a); r2.push(b) } }
    push(0, 0, 20); push(0, 1, 5); push(1, 0, 10); push(1, 1, 15)
    expect(weightedKappa(r1, r2, [0, 1], 'none')).toBeCloseTo(0.4, 6)
  })
  it('la ponderación cuadrática penaliza más los saltos grandes que los pequeños', () => {
    const cats = [-2, -1, 1, 2]; const ref = [-2, -1, 1, 2, 2, -2, 1, -1]
    const pequeno = [-1, -1, 1, 1, 2, -2, 1, -1], grande = [2, -1, 1, -2, 2, -2, 1, -1]
    expect(weightedKappa(ref, pequeno, cats, 'quadratic')).toBeGreaterThan(weightedKappa(ref, grande, cats, 'quadratic'))
  })
})
describe('Gwet AC1/AC2', () => {
  it('ejemplo calculado a mano: AC1 = 0,5294 (pa=0,75; pe=0,46875)', () => {
    expect(gwetAC([[1, 1], [1, 1], [0, 0], [1, 0]], [0, 1], 'none')).toBeCloseTo(0.5294, 3)
  })
  it('acuerdo perfecto = 1 aunque la distribución esté muy sesgada', () => {
    const u = Array.from({ length: 20 }, () => [2, 2]); u.push([1, 1])
    expect(gwetAC(u, [-2, -1, 1, 2], 'quadratic')).toBeCloseTo(1, 10)
  })
})
