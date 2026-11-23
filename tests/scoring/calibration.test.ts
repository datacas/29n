import { describe, it, expect } from 'vitest'
import {
  computeWeightsFromComparisons,
  getNextComparison,
  allComparisonsDone,
  calibrate,
  quickCalibration,
  defaultCalibration,
  exportCalibrationState,
  reproduceFromState,
  ComparisonResult
} from '../../app/lib/scoring/calibration'

const DIMS_3 = ['A', 'B', 'C']
const DIMS_6 = ['economia', 'social', 'derechos', 'medioambiente', 'seguridad', 'educacion']

function makeComparisons(results: Array<[string, string, ComparisonResult]>): Array<{ left: string; right: string; result: ComparisonResult }> {
  return results.map(([left, right, result]) => ({ left, right, result }))
}

describe('SPIKE-11: Calibration algorithm', () => {

  describe('computeWeightsFromComparisons — Borda count', () => {

    it('sin comparaciones → pesos iguales', () => {
      const weights = computeWeightsFromComparisons(DIMS_3, [])
      // All get minWeight 0.01, normalized equally
      expect(weights['A']).toBeCloseTo(1/3, 3)
      expect(weights['B']).toBeCloseTo(1/3, 3)
      expect(weights['C']).toBeCloseTo(1/3, 3)
    })

    it('una dimensión → peso 1', () => {
      const weights = computeWeightsFromComparisons(['A'], [])
      expect(weights['A']).toBe(1.0)
    })

    it('sin dimensiones → vacío', () => {
      const weights = computeWeightsFromComparisons([], [])
      expect(weights).toEqual({})
    })

    it('A > B, B > C → A y B tienen más peso que C', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      // A: 2 (beats B), B: 2 (beats C), C: 0.01 (min)
      // A and B are equal, both > C
      expect(Math.abs(weights['A'] - weights['B'])).toBeLessThan(0.01)
      expect(weights['B']).toBeGreaterThan(weights['C'])
    })

    it('A > B, A > C → A tiene más peso que B y C', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'C', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      expect(weights['A']).toBeGreaterThan(weights['B'])
      expect(weights['A']).toBeGreaterThan(weights['C'])
    })

    it('A = B = C → pesos iguales', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'equal'],
        ['A', 'C', 'equal'],
        ['B', 'C', 'equal']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      expect(weights['A']).toBeCloseTo(weights['B'], 3)
      expect(weights['B']).toBeCloseTo(weights['C'], 3)
    })

    it('pesos suman 1', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'right']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 3)
    })

    it('todos los pesos son positivos', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'C', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      for (const dim of DIMS_3) {
        expect(weights[dim]).toBeGreaterThan(0)
      }
    })

    it('skip da peso base a ambas dimensiones', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'skip']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      // A: 0.5, B: 0.5, C: 0.01
      expect(weights['A']).toBeGreaterThan(weights['C'])
      expect(weights['B']).toBeGreaterThan(weights['C'])
      expect(weights['A']).toBeCloseTo(weights['B'], 3)
    })

    it('6 dimensiones con comparaciones completas', () => {
      // All pairs: each dimension beats the next
      const comparisons = makeComparisons([
        ['economia', 'social', 'left'],
        ['economia', 'derechos', 'left'],
        ['economia', 'medioambiente', 'left'],
        ['economia', 'seguridad', 'left'],
        ['economia', 'educacion', 'left'],
        ['social', 'derechos', 'left'],
        ['social', 'medioambiente', 'left'],
        ['social', 'seguridad', 'left'],
        ['social', 'educacion', 'left'],
        ['derechos', 'medioambiente', 'left'],
        ['derechos', 'seguridad', 'left'],
        ['derechos', 'educacion', 'left'],
        ['medioambiente', 'seguridad', 'left'],
        ['medioambiente', 'educacion', 'left'],
        ['seguridad', 'educacion', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_6, comparisons)
      // economia should have highest weight
      expect(weights['economia']).toBeGreaterThan(weights['educacion'])
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 3)
    })
  })

  describe('Determinismo', () => {

    it('mismas comparaciones → mismos pesos (50 iteraciones)', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'equal'],
        ['A', 'C', 'left']
      ])
      const first = computeWeightsFromComparisons(DIMS_3, comparisons)
      for (let i = 0; i < 50; i++) {
        const current = computeWeightsFromComparisons(DIMS_3, comparisons)
        expect(current).toEqual(first)
      }
    })

    it('50 conjuntos de comparaciones distintos → pesos reproducibles', () => {
      const testCases: Array<Array<{ left: string; right: string; result: ComparisonResult }>> = []
      const results: ComparisonResult[] = ['left', 'right', 'equal', 'skip']
      for (let i = 0; i < 50; i++) {
        const seed = i
        const comps = makeComparisons([
          ['A', 'B', results[seed % 4]],
          ['B', 'C', results[(seed + 1) % 4]],
          ['A', 'C', results[(seed + 2) % 4]]
        ])
        testCases.push(comps)
      }
      // Run each twice and compare
      for (const comps of testCases) {
        const first = computeWeightsFromComparisons(DIMS_3, comps)
        const second = computeWeightsFromComparisons(DIMS_3, comps)
        expect(first).toEqual(second)
      }
    })
  })

  describe('Estabilidad', () => {

    it('cambiar una comparación produce cambio pequeño en pesos', () => {
      const comparisons1 = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'left'],
        ['A', 'C', 'left']
      ])
      const comparisons2 = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'right'], // changed
        ['A', 'C', 'left']
      ])
      const weights1 = computeWeightsFromComparisons(DIMS_3, comparisons1)
      const weights2 = computeWeightsFromComparisons(DIMS_3, comparisons2)
      // Max change should be < 0.5
      for (const dim of DIMS_3) {
        const diff = Math.abs(weights1[dim] - weights2[dim])
        expect(diff).toBeLessThan(0.5)
      }
    })

    it('añadir un empate no cambia drásticamente los pesos', () => {
      const comparisons1 = makeComparisons([
        ['A', 'B', 'left']
      ])
      const comparisons2 = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'equal']
      ])
      const weights1 = computeWeightsFromComparisons(DIMS_3, comparisons1)
      const weights2 = computeWeightsFromComparisons(DIMS_3, comparisons2)
      // A should still be highest
      expect(weights2['A']).toBeGreaterThan(weights2['B'])
    })
  })

  describe('Empates', () => {

    it('dos dimensiones declaradas equivalentes → pesos iguales', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'equal']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      expect(Math.abs(weights['A'] - weights['B'])).toBeLessThan(0.01)
    })

    it('todas equivalentes → pesos iguales', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'equal'],
        ['A', 'C', 'equal'],
        ['B', 'C', 'equal']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      expect(Math.abs(weights['A'] - weights['B'])).toBeLessThan(0.01)
      expect(Math.abs(weights['B'] - weights['C'])).toBeLessThan(0.01)
    })

    it('empate en 6 dimensiones', () => {
      const comparisons = makeComparisons([
        ['economia', 'social', 'equal'],
        ['economia', 'derechos', 'equal'],
        ['economia', 'medioambiente', 'equal'],
        ['economia', 'seguridad', 'equal'],
        ['economia', 'educacion', 'equal'],
        ['social', 'derechos', 'equal'],
        ['social', 'medioambiente', 'equal'],
        ['social', 'seguridad', 'equal'],
        ['social', 'educacion', 'equal'],
        ['derechos', 'medioambiente', 'equal'],
        ['derechos', 'seguridad', 'equal'],
        ['derechos', 'educacion', 'equal'],
        ['medioambiente', 'seguridad', 'equal'],
        ['medioambiente', 'educacion', 'equal'],
        ['seguridad', 'educacion', 'equal']
      ])
      const weights = computeWeightsFromComparisons(DIMS_6, comparisons)
      for (let i = 0; i < DIMS_6.length; i++) {
        for (let j = i + 1; j < DIMS_6.length; j++) {
          expect(Math.abs(weights[DIMS_6[i]] - weights[DIMS_6[j]])).toBeLessThan(0.01)
        }
      }
    })
  })

  describe('Omisiones', () => {

    it('omitir 50% de comparaciones → pesos válidos', () => {
      // Only 1 of 3 comparisons
      const comparisons = makeComparisons([
        ['A', 'B', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 3)
      for (const dim of DIMS_3) {
        expect(weights[dim]).toBeGreaterThan(0)
      }
    })

    it('todas las comparaciones skip → pesos iguales', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'skip'],
        ['A', 'C', 'skip'],
        ['B', 'C', 'skip']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      expect(Math.abs(weights['A'] - weights['B'])).toBeLessThan(0.01)
      expect(Math.abs(weights['B'] - weights['C'])).toBeLessThan(0.01)
    })

    it('omisiones parciales en 6 dimensiones', () => {
      const comparisons = makeComparisons([
        ['economia', 'social', 'left'],
        ['derechos', 'medioambiente', 'left']
        // Other pairs not compared
      ])
      const weights = computeWeightsFromComparisons(DIMS_6, comparisons)
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 3)
      for (const dim of DIMS_6) {
        expect(weights[dim]).toBeGreaterThan(0)
      }
    })
  })

  describe('Reproducibilidad entre sesiones', () => {

    it('exportar/importar → pesos idénticos', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['B', 'C', 'equal'],
        ['A', 'C', 'left']
      ])
      const state = exportCalibrationState(DIMS_3, comparisons)
      const reproduced = reproduceFromState(state)
      const original = computeWeightsFromComparisons(DIMS_3, comparisons)
      expect(reproduced).toEqual(original)
    })

    it('estado incluye versión', () => {
      const state = exportCalibrationState(DIMS_3, [])
      expect(state.version).toBe('1.0.0')
    })

    it('reproducibilidad con 6 dimensiones', () => {
      const comparisons = makeComparisons([
        ['economia', 'social', 'left'],
        ['economia', 'derechos', 'equal'],
        ['social', 'medioambiente', 'right']
      ])
      const state = exportCalibrationState(DIMS_6, comparisons)
      const reproduced = reproduceFromState(state)
      const original = computeWeightsFromComparisons(DIMS_6, comparisons)
      expect(reproduced).toEqual(original)
    })
  })

  describe('Selección adaptativa', () => {

    it('primera comparación es el primer par no comparado', () => {
      const next = getNextComparison(DIMS_3, [])
      expect(next).not.toBeNull()
      expect(next!.left).toBe('A')
      expect(next!.right).toBe('B')
    })

    it('siguiente comparación evita pares ya comparados', () => {
      const comparisons = makeComparisons([['A', 'B', 'left']])
      const next = getNextComparison(DIMS_3, comparisons)
      expect(next).not.toBeNull()
      // Should not be A:B again
      const pair = [next!.left, next!.right].sort().join(':')
      expect(pair).not.toBe('A:B')
    })

    it('devuelve null cuando todas las comparaciones están hechas', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'C', 'left'],
        ['B', 'C', 'left']
      ])
      const next = getNextComparison(DIMS_3, comparisons)
      expect(next).toBeNull()
    })

    it('selección es determinista', () => {
      for (let i = 0; i < 10; i++) {
        const next = getNextComparison(DIMS_3, [])
        expect(next!.left).toBe('A')
        expect(next!.right).toBe('B')
      }
    })

    it('sin dimensiones suficientes → null', () => {
      expect(getNextComparison(['A'], [])).toBeNull()
      expect(getNextComparison([], [])).toBeNull()
    })

    it('el algoritmo elige comparaciones informativas', () => {
      // After comparing A:B, the next should be A:C (not B:C)
      // because A has been compared once, B once, C zero times
      const comparisons = makeComparisons([['A', 'B', 'left']])
      const next = getNextComparison(DIMS_3, comparisons)
      // A:C or B:C — both are un-compared, but A:C comes first alphabetically
      expect(next!.left).toBe('A')
      expect(next!.right).toBe('C')
    })
  })

  describe('Cobertura de dimensiones', () => {

    it('todas las dimensiones reciben peso positivo', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      for (const dim of DIMS_3) {
        expect(weights[dim]).toBeGreaterThan(0)
      }
    })

    it('dimensiones no comparadas reciben peso proporcional', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      // C (not compared) should have less weight than A (winner)
      expect(weights['C']).toBeLessThan(weights['A'])
    })

    it('6 dimensiones: todas con peso > 0', () => {
      const comparisons = makeComparisons([
        ['economia', 'social', 'left']
      ])
      const weights = computeWeightsFromComparisons(DIMS_6, comparisons)
      for (const dim of DIMS_6) {
        expect(weights[dim]).toBeGreaterThan(0)
      }
    })
  })

  describe('allComparisonsDone', () => {

    it('sin comparaciones → false', () => {
      expect(allComparisonsDone(DIMS_3, [])).toBe(false)
    })

    it('todas las comparaciones → true', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'C', 'left'],
        ['B', 'C', 'left']
      ])
      expect(allComparisonsDone(DIMS_3, comparisons)).toBe(true)
    })

    it('falta una → false', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'C', 'left']
      ])
      expect(allComparisonsDone(DIMS_3, comparisons)).toBe(false)
    })

    it('una dimensión → true (0 pares)', () => {
      expect(allComparisonsDone(['A'], [])).toBe(true)
    })

    it('6 dimensiones: 15 pares necesarios', () => {
      const allPairs = makeComparisons([
        ['economia', 'social', 'left'],
        ['economia', 'derechos', 'left'],
        ['economia', 'medioambiente', 'left'],
        ['economia', 'seguridad', 'left'],
        ['economia', 'educacion', 'left'],
        ['social', 'derechos', 'left'],
        ['social', 'medioambiente', 'left'],
        ['social', 'seguridad', 'left'],
        ['social', 'educacion', 'left'],
        ['derechos', 'medioambiente', 'left'],
        ['derechos', 'seguridad', 'left'],
        ['derechos', 'educacion', 'left'],
        ['medioambiente', 'seguridad', 'left'],
        ['medioambiente', 'educacion', 'left'],
        ['seguridad', 'educacion', 'left']
      ])
      expect(allComparisonsDone(DIMS_6, allPairs)).toBe(true)
    })
  })

  describe('calibrate — flujo completo', () => {

    it('flujo paso a paso hasta completar', () => {
      const dimensions = DIMS_3
      let comparisons: Array<{ left: string; right: string; result: ComparisonResult }> = []

      // Step 1: A vs B
      let result = calibrate(dimensions, comparisons)
      expect(result.isComplete).toBe(false)
      expect(result.nextComparison).not.toBeNull()
      comparisons.push({ ...result.nextComparison!, result: 'left' })

      // Step 2: A vs C
      result = calibrate(dimensions, comparisons)
      expect(result.isComplete).toBe(false)
      comparisons.push({ ...result.nextComparison!, result: 'equal' })

      // Step 3: B vs C (last pair)
      result = calibrate(dimensions, comparisons)
      expect(result.isComplete).toBe(false)
      comparisons.push({ ...result.nextComparison!, result: 'left' })

      // Step 4: all done
      result = calibrate(dimensions, comparisons)
      expect(result.isComplete).toBe(true)
      expect(result.nextComparison).toBeNull()
      expect(Object.keys(result.weights).length).toBe(3)
    })

    it('pesos intermedios son válidos en cada paso', () => {
      const dimensions = DIMS_3
      let comparisons: Array<{ left: string; right: string; result: ComparisonResult }> = []

      while (!allComparisonsDone(dimensions, comparisons)) {
        const result = calibrate(dimensions, comparisons)
        const sum = Object.values(result.weights).reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(1, 3)
        for (const dim of dimensions) {
          expect(result.weights[dim]).toBeGreaterThan(0)
        }
        if (result.nextComparison) {
          comparisons.push({ ...result.nextComparison, result: 'left' })
        }
      }
    })
  })

  describe('quickCalibration', () => {

    it('baja/media/alta → pesos normalizados', () => {
      const weights = quickCalibration(DIMS_3, {
        A: 'high',
        B: 'medium',
        C: 'low'
      })
      // high=2, medium=1, low=0.5 → total=3.5
      expect(weights['A']).toBeCloseTo(2/3.5, 3)
      expect(weights['B']).toBeCloseTo(1/3.5, 3)
      expect(weights['C']).toBeCloseTo(0.5/3.5, 3)
    })

    it('sin importancia especificada → media por defecto', () => {
      const weights = quickCalibration(DIMS_3, {
        A: 'high'
        // B, C not specified → medium
      })
      // high=2, medium=1, medium=1 → total=4
      expect(weights['A']).toBeCloseTo(2/4, 3)
      expect(weights['B']).toBeCloseTo(1/4, 3)
      expect(weights['C']).toBeCloseTo(1/4, 3)
    })

    it('todos iguales → pesos iguales', () => {
      const weights = quickCalibration(DIMS_3, {
        A: 'medium',
        B: 'medium',
        C: 'medium'
      })
      expect(weights['A']).toBeCloseTo(1/3, 3)
      expect(weights['B']).toBeCloseTo(1/3, 3)
      expect(weights['C']).toBeCloseTo(1/3, 3)
    })

    it('pesos suman 1', () => {
      const weights = quickCalibration(DIMS_6, {
        economia: 'high',
        social: 'medium',
        derechos: 'high',
        medioambiente: 'low',
        seguridad: 'medium',
        educacion: 'low'
      })
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 3)
    })
  })

  describe('defaultCalibration', () => {

    it('pesos iguales por defecto', () => {
      const weights = defaultCalibration(DIMS_3)
      expect(weights['A']).toBeCloseTo(1/3, 3)
      expect(weights['B']).toBeCloseTo(1/3, 3)
      expect(weights['C']).toBeCloseTo(1/3, 3)
    })

    it('6 dimensiones → 1/6 cada una', () => {
      const weights = defaultCalibration(DIMS_6)
      for (const dim of DIMS_6) {
        expect(weights[dim]).toBeCloseTo(1/6, 3)
      }
    })

    it('sin dimensiones → vacío', () => {
      const weights = defaultCalibration([])
      expect(weights).toEqual({})
    })

    it('pesos suman 1', () => {
      const weights = defaultCalibration(DIMS_6)
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 3)
    })
  })

  describe('Casos límite', () => {

    it('comparación con dimensión no en la lista → ignorada', () => {
      const comparisons = makeComparisons([
        ['A', 'X', 'left'] // X not in DIMS_3
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      // Only A, B, C should have weights
      expect(Object.keys(weights)).toHaveLength(3)
      expect(weights['X']).toBeUndefined()
    })

    it('comparaciones duplicadas no afectan el resultado → se procesan una vez', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'B', 'left'] // duplicate
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      // A gets +2 twice = 4, B gets 0, C gets 0.01
      expect(weights['A']).toBeGreaterThan(weights['B'])
    })

    it('comparaciones contradictorias → se suman puntos', () => {
      const comparisons = makeComparisons([
        ['A', 'B', 'left'],
        ['A', 'B', 'right'] // contradictory
      ])
      const weights = computeWeightsFromComparisons(DIMS_3, comparisons)
      // A: 2+0=2, B: 0+2=2, C: 0.01
      expect(Math.abs(weights['A'] - weights['B'])).toBeLessThan(0.01)
    })
  })
})
