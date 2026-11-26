import { describe, it, expect } from 'vitest'
import {
  isLowCoverage,
  sortResults,
  MIN_EVALUABLE_QUESTIONS,
  MIN_COVERAGE_PERCENT
} from '../../app/lib/scoring/ranking.ts'

const row = (p: number | null, evaluable: number, answered = 32) => ({
  affinityPercent: p,
  evaluableQuestions: evaluable,
  answeredQuestions: answered,
  coveragePercent: answered > 0 ? Math.round((evaluable / answered) * 1000) / 10 : 0
})

describe('ranking y marca de pocos datos', () => {
  it('un resultado con muestra suficiente no se marca como pocos datos', () => {
    expect(isLowCoverage(row(80, 12))).toBe(false)
    expect(isLowCoverage(row(50, MIN_EVALUABLE_QUESTIONS))).toBe(false)
  })

  it('se marca con pocas preguntas evaluables aunque el % de cobertura llegue al umbral', () => {
    // 6/16 = 37,5 % de cobertura, pero solo 6 preguntas: no es base suficiente
    const r = row(95, 6, 16)
    expect(r.coveragePercent).toBeGreaterThan(MIN_COVERAGE_PERCENT)
    expect(isLowCoverage(r)).toBe(true)
  })

  it('se marca cuando la cobertura es baja aunque haya 8 preguntas', () => {
    expect(isLowCoverage(row(70, 8, 60))).toBe(true)
  })

  it('no marca "sin datos suficientes" (null) como pocos datos', () => {
    expect(isLowCoverage(row(null, 0))).toBe(false)
  })

  it('si la persona contesta menos de 8 preguntas no se exige un mínimo mayor que lo contestado', () => {
    expect(isLowCoverage(row(70, 5, 5))).toBe(false)
  })

  it('los partidos con pocos datos van al final aunque tengan más porcentaje', () => {
    const small = row(95, 6, 16)
    const solid = row(60, 12, 16)
    expect(sortResults([small, solid]).map((r) => r.affinityPercent)).toEqual([60, 95])
  })

  it('sin datos va detrás de todos los que tienen porcentaje', () => {
    const none = row(null, 0)
    const low = row(30, 4, 16)
    const solid = row(10, 12, 16)
    expect(sortResults([none, low, solid]).map((r) => r.affinityPercent)).toEqual([10, 30, null])
  })

  it('entre resultados con datos suficientes ordena de mayor a menor', () => {
    const r = sortResults([row(40, 12), row(80, 12), row(60, 12)])
    expect(r.map((x) => x.affinityPercent)).toEqual([80, 60, 40])
  })
})

describe('umbral de pocos datos configurable por encuesta', () => {
  // Encuesta histórica: 15 preguntas, umbral 5
  it('con mínimo 5, cinco posiciones evaluables no se marcan', () => {
    expect(isLowCoverage(row(60, 5, 15), 5)).toBe(false)
  })
  it('con mínimo 5, tres posiciones evaluables sí se marcan', () => {
    expect(isLowCoverage(row(60, 3, 15), 5)).toBe(true)
  })
  it('sin mínimo explícito se usa el general de 8', () => {
    expect(MIN_EVALUABLE_QUESTIONS).toBe(8)
    expect(isLowCoverage(row(60, 5, 15))).toBe(true)
  })
  it('el orden respeta el mínimo de la encuesta', () => {
    const r = sortResults([row(90, 3, 15), row(50, 6, 15), row(70, 5, 15)], 5)
    expect(r.map((x) => x.affinityPercent)).toEqual([70, 50, 90])
  })
})

describe('Grupo de cabeza por diferencia pequeña (umbral de 3 puntos)', () => {
  const r = (entityId: string, affinityPercent: number | null) => ({ entityId, affinityPercent })
  const all = () => true
  it('agrupa los que están a menos de 3 puntos del primero', async () => {
    const { leadingGroup } = await import('../../app/lib/scoring/ranking')
    expect([...leadingGroup([r('a', 70), r('b', 68.5), r('c', 67.1), r('d', 50)], all)]).toEqual(['a', 'b', 'c'])
  })
  it('no encadena: se mide desde el primero, no entre vecinos', async () => {
    const { leadingGroup } = await import('../../app/lib/scoring/ranking')
    expect([...leadingGroup([r('a', 70), r('b', 68), r('c', 66), r('d', 64)], all)]).toEqual(['a', 'b'])
  })
  it('un primero claro no forma grupo', async () => {
    const { leadingGroup } = await import('../../app/lib/scoring/ranking')
    expect(leadingGroup([r('a', 80), r('b', 70), r('c', 60)], all).size).toBe(0)
  })
  it('exactamente 3 puntos de diferencia ya no es grupo', async () => {
    const { leadingGroup } = await import('../../app/lib/scoring/ranking')
    expect(leadingGroup([r('a', 70), r('b', 67)], all).size).toBe(0)
  })
  it('los candidatos descartados (pocos datos, históricos) no entran ni encabezan', async () => {
    const { leadingGroup } = await import('../../app/lib/scoring/ranking')
    const low = new Set(['x'])
    expect([...leadingGroup([r('x', 90), r('a', 70), r('b', 69)], (q) => !low.has(q.entityId))]).toEqual(['a', 'b'])
  })
  it('sin resultados con porcentaje no hay grupo', async () => {
    const { leadingGroup } = await import('../../app/lib/scoring/ranking')
    expect(leadingGroup([r('a', null)], all).size).toBe(0)
  })
})
