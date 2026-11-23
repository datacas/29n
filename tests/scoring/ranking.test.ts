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
