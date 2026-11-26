import { describe, it, expect } from 'vitest'
// @ts-expect-error módulo .mjs sin tipos
import { systematic, replacements, inclusion, stratifiedProportion, kishNeff } from '../../scripts/methodology/sampling.mjs'

describe('muestreo sistemático estratificado', () => {
  it('es determinista por semilla y devuelve n índices distintos y ordenados', () => {
    const a = systematic(598, 45, 7), b = systematic(598, 45, 7), c = systematic(598, 45, 8)
    expect(a).toEqual(b); expect(a).not.toEqual(c); expect(new Set(a).size).toBe(45); expect([...a].sort((x, y) => x - y)).toEqual(a)
    expect(a.every((i: number) => i >= 0 && i < 598)).toBe(true)
  })
  it('reparte a lo largo de todo el estrato ordenado (estratificación implícita)', () => {
    const a = systematic(600, 30, 3); const gaps = a.slice(1).map((x: number, i: number) => x - a[i]); expect(Math.max(...gaps)).toBeLessThanOrEqual(21); expect(Math.min(...gaps)).toBeGreaterThanOrEqual(19)
  })
  it('censo cuando n = N y error cuando n > N', () => { expect(systematic(6, 6, 1)).toEqual([0, 1, 2, 3, 4, 5]); expect(() => systematic(5, 6, 1)).toThrow() })
  it('cada elegido tiene un reemplazo predefinido distinto de los elegidos', () => {
    const chosen = systematic(64, 20, 11); const r = replacements(64, chosen)
    for (const i of chosen) { expect(chosen.includes(r[i])).toBe(false); expect(r[i]).not.toBeNull() }
  })
  it('probabilidad de inclusión y peso', () => { const { pi, weight } = inclusion(64, 20); expect(pi).toBeCloseTo(0.3125, 6); expect(weight).toBeCloseTo(3.2, 6) })
})

describe('estimadores con pesos de diseño', () => {
  it('la proporción ponderada reconstruye la población (no la de la muestra)', () => {
    // dos estratos: 900 celdas con 10 % y 100 con 50 %; muestra 50 + 50 → la muestra bruta daría 30 %, la ponderada ≈ 14 %
    const r = stratifiedProportion([{ N: 900, n: 50, x: 5 }, { N: 100, n: 50, x: 25 }])
    expect(r.p).toBeCloseTo(0.9 * 0.1 + 0.1 * 0.5, 6); expect(r.p).not.toBeCloseTo(0.3, 2)
  })
  it('el error estándar coincide con la fórmula estratificada con corrección de población finita (a mano)', () => {
    const r = stratifiedProportion([{ N: 900, n: 50, x: 5 }, { N: 100, n: 50, x: 25 }])
    const v = 0.9 ** 2 * (1 - 50 / 900) * 0.1 * 0.9 / 49 + 0.1 ** 2 * (1 - 50 / 100) * 0.5 * 0.5 / 49
    expect(r.se).toBeCloseTo(Math.sqrt(v), 8); expect(r.lo).toBeLessThan(r.p); expect(r.hi).toBeGreaterThan(r.p)
  })
  it('NO equivale al IC de una muestra aleatoria simple con la proporción bruta de la muestra', () => {
    const r = stratifiedProportion([{ N: 900, n: 50, x: 5 }, { N: 100, n: 50, x: 25 }]); const raw = 30 / 100
    expect(Math.abs(r.p - raw)).toBeGreaterThan(0.1)
  })
  it('con censo (n = N) no hay incertidumbre de muestreo', () => { const r = stratifiedProportion([{ N: 6, n: 6, x: 3 }]); expect(r.se).toBe(0); expect(r.lo).toBe(r.hi) })
  it('Kish: pesos iguales → n; pesos muy desiguales → menos', () => { expect(kishNeff([2, 2, 2, 2])).toBeCloseTo(4, 6); expect(kishNeff([1, 1, 1, 10])).toBeLessThan(2) })
})
