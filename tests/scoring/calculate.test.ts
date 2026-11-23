import { describe, it, expect } from 'vitest'
import {
  calculateScoring,
  Answer,
  Position,
  Weight,
  EntityInfo,
  Question,
  DimensionCalibration
} from '../../app/lib/scoring/calculate'

// --- Helpers ---

function makeQuestions(dimensions: [string, string][]): Question[] {
  return dimensions.map(([id, dim]) => ({ questionId: id, dimensionId: dim }))
}

function makeAnswers(questionIds: string[], values: number[], skipped?: boolean[]): Answer[] {
  return questionIds.map((id, i) => ({
    questionId: id,
    value: values[i],
    skipped: skipped?.[i] ?? false
  }))
}

function makePositions(entityId: string, mappings: [string, number, string][]): Position[] {
  return mappings.map(([qId, value, status]) => ({
    entityId,
    questionId: qId,
    value,
    status,
    evidenceRef: `evidence-${qId}`
  }))
}

function makeWeights(questionIds: string[], importances: string[]): Weight[] {
  return questionIds.map((id, i) => ({ questionId: id, importance: importances[i] as any }))
}

const DIM_NAMES = {
  economia: 'Economía',
  social: 'Social',
  derechos: 'Derechos',
  medioambiente: 'Medio ambiente',
  seguridad: 'Seguridad',
  educacion: 'Educación'
}

// --- Tests ---

describe('SPIKE-06: Scoring engine', () => {

  describe('Proximidad por pregunta', () => {

    it('coincidencia total da 100%', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(100)
    })

    it('desacuerdo total da 0%', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', -2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(0)
    })

    it('neutralidad da 50%', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(50)
    })

    it('proximidad parcial: +2 vs +1 = 75%', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 1, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(75)
    })

    it('proximidad parcial: +1 vs -1 = 50%', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [1])
      const positions = makePositions('A', [['Q1', -1, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(50)
    })
  })

  describe('Estados de posición', () => {

    it('approved se incluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(1)
    })

    it('explicit_neutral se incluye con valor 0', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'explicit_neutral']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(1)
      expect(result[0].affinityPercent).toBe(50) // |2-0|/4 = 0.5, proximity = 0.5
    })

    it('conditional se incluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'conditional']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(1)
    })

    it('not_stated se excluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'not_stated']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(0)
      expect(result[0].affinityPercent).toBeNull()
    })

    it('unknown se excluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'unknown']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(0)
    })

    it('not_comparable se excluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'not_comparable']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(0)
    })

    it('ambiguous se excluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'ambiguous']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(0)
    })

    it('conflicting_sources se excluye', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 0, 'conflicting_sources']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evaluableQuestions).toBe(0)
    })
  })

  describe('Casos límite', () => {

    it('sin posiciones evaluables → Sin datos suficientes', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions: Position[] = []
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBeNull()
      expect(result[0].evaluableQuestions).toBe(0)
    })

    it('todas las respuestas omitidas → Sin datos', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2], [true])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBeNull()
    })

    it('una sola pregunta → score calculado', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(100)
      expect(result[0].evaluableQuestions).toBe(1)
    })

    it('entidad sin posiciones entre entidades con posiciones', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [
        { entityId: 'A', historical: false },
        { entityId: 'B', historical: false }
      ]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result.find(r => r.entityId === 'A')!.affinityPercent).toBe(100)
      expect(result.find(r => r.entityId === 'B')!.affinityPercent).toBeNull()
    })
  })

  describe('Pesos por importancia', () => {

    it('peso alto (2.0) influye más que peso bajo (0.5)', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // match, high weight
        ['Q2', -2, 'approved'] // mismatch, low weight
      ])
      const weights = makeWeights(['Q1', 'Q2'], ['high', 'low'])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES)
      // Q1: s=1, w=2; Q2: s=0, w=0.5 → (1*2 + 0*0.5)/(2+0.5) = 2/2.5 = 0.8 → 80%
      expect(result[0].affinityPercent).toBe(80)
    })

    it('peso medio por defecto cuando no se especifica', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'],
        ['Q2', 0, 'approved']
      ])
      const weights = makeWeights(['Q1'], ['high']) // Q2 no tiene peso → medium
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES)
      // Q1: s=1, w=2; Q2: s=0.5, w=1 → (1*2 + 0.5*1)/(2+1) = 2.5/3 = 0.833 → 83.3%
      expect(result[0].affinityPercent).toBe(83.3)
    })

    it('todos los pesos en baja → score calculado normalmente', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'],
        ['Q2', 2, 'approved']
      ])
      const weights = makeWeights(['Q1', 'Q2'], ['low', 'low'])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(100)
    })
  })

  describe('Scoring multidimensional', () => {

    it('dos dimensiones con cobertura igual → media simple', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'derechos'], ['Q4', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4'], [2, 2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 2, 'approved'],
        ['Q3', 2, 'approved'], ['Q4', 0, 'approved']
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      // Economía: avg_s = (1*1 + 1*1)/(1+1) = 1.0 → 100%
      // Derechos: avg_s = (1*1 + 0.5*1)/(1+1) = 0.75 → 75%
      // Global: (100 + 75) / 2 = 87.5%
      expect(result[0].affinityPercent).toBe(87.5)
      expect(result[0].dimensions.length).toBe(2)
    })

    it('dimensión vacía no se muestra', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [['Q1', 2, 'approved']]) // solo Economía
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].dimensions.length).toBe(1)
      expect(result[0].dimensions[0].dimensionId).toBe('economia')
    })

    it('entidad con evidencia en una dimensión → 100% si coincide', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social'], ['Q3', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3'], [2, 2, 2])
      const positions = makePositions('A', [['Q1', 2, 'approved']]) // solo Economía
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(100)
      expect(result[0].dimensionsWithCoverage).toBe(1)
      expect(result[0].totalDimensions).toBe(3)
    })

    it('ejemplo 6: score multidimensional con renormalización', () => {
      // From scoring-methodology.md Example 6
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social'],
        ['Q5', 'derechos'], ['Q6', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 1, -1, 0, 2, 1])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 1, 'approved'],
        // Q3, Q4: no position (not_stated)
        ['Q5', 2, 'approved'], ['Q6', -1, 'approved']
      ])
      const weights = makeWeights(['Q5'], ['high']) // Q5 high weight
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES)
      // Economía: avg_s = (1*1 + 1*1)/(1+1) = 1.0 → 100%
      // Derechos: avg_s = (1*2 + 0.5*1)/(2+1) = 0.833 → 83.3%
      // Global: (100 + 83.3) / 2 = 91.7%
      expect(result[0].affinityPercent).toBe(91.7)
      expect(result[0].dimensionsWithCoverage).toBe(2)
      expect(result[0].totalDimensions).toBe(3)
    })

    it('ejemplo 7: entidad con evidencia en una dimensión → 100% con renormalización', () => {
      // From scoring-methodology.md Example 7
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social'],
        ['Q5', 'derechos'], ['Q6', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 1, -1, 0, 2, 1])
      const positions = makePositions('B', [
        ['Q1', 2, 'approved'], ['Q2', 1, 'approved']
        // Q3-Q6: no position
      ])
      const entities = [{ entityId: 'B', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].affinityPercent).toBe(100)
      expect(result[0].dimensionsWithCoverage).toBe(1)
      expect(result[0].totalDimensions).toBe(3)
      expect(result[0].coveragePercent).toBe(33.3) // 2/6
    })
  })

  describe('Renormalización de pesos', () => {

    it('entidad con evidencia en 1 de 6 dimensiones y 100% → score 100%', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social'], ['Q3', 'derechos'],
        ['Q4', 'medioambiente'], ['Q5', 'seguridad'], ['Q6', 'educacion']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 2, 2, 2, 2, 2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'skipped',
        weights: {
          economia: 1/6, social: 1/6, derechos: 1/6,
          medioambiente: 1/6, seguridad: 1/6, educacion: 1/6
        }
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      expect(result[0].affinityPercent).toBe(100)
    })

    it('entidad con evidencia en 2 de 6 dimensiones → pesos redistribuidos', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social'], ['Q3', 'derechos'],
        ['Q4', 'medioambiente'], ['Q5', 'seguridad'], ['Q6', 'educacion']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 2, 2, 2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // Economía: 100%
        ['Q3', 0, 'approved']  // Derechos: 50%
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'skipped',
        weights: {
          economia: 1/6, social: 1/6, derechos: 1/6,
          medioambiente: 1/6, seguridad: 1/6, educacion: 1/6
        }
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      // Renormalización: μ_economia = (1/6)/(1/6+1/6) = 0.5, μ_derechos = 0.5
      // C = 0.5*100 + 0.5*50 = 75%
      expect(result[0].affinityPercent).toBe(75)
    })

    it('ejemplo 8: calibración seria con renormalización', () => {
      // From scoring-methodology.md Example 8
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social'],
        ['Q5', 'derechos'], ['Q6', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 1, -1, 0, 2, 1])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 1, 'approved'],
        ['Q5', 2, 'approved'], ['Q6', -1, 'approved']
      ])
      const weights = makeWeights(['Q5'], ['high'])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'serious',
        weights: { economia: 0.7, social: 0.0, derechos: 0.3 }
      }
      const result = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES, calibration)
      // Renormalización: sum_λ = 0.7 + 0.3 = 1.0
      // μ_Economía = 0.7, μ_Derechos = 0.3
      // C = 0.7*100 + 0.3*83.3 = 95.0%
      expect(result[0].affinityPercent).toBe(95)
    })

    it('calibración seria con entidad en una dimensión → renormalización a 1', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social'],
        ['Q5', 'derechos'], ['Q6', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 1, -1, 0, 2, 1])
      const positions = makePositions('B', [
        ['Q1', 2, 'approved'], ['Q2', 1, 'approved']
      ])
      const entities = [{ entityId: 'B', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'serious',
        weights: { economia: 0.7, social: 0.0, derechos: 0.3 }
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      // Renormalización: sum_λ = 0.7, μ_Economía = 0.7/0.7 = 1.0
      // C = 1.0*100 = 100%
      expect(result[0].affinityPercent).toBe(100)
    })
  })

  describe('Calibración rápida', () => {

    it('baja/media/alta → pesos normalizados', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social'], ['Q3', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3'], [2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // Economía: 100%
        ['Q2', 0, 'approved'], // Social: 50%
        ['Q3', -2, 'approved'] // Derechos: 0%
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'quick',
        weights: { economia: 2.0, social: 1.0, derechos: 0.5 } // alta, media, baja
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      // Normalización: sum = 3.5
      // μ_Economía = 2/3.5 = 0.571, μ_Social = 1/3.5 = 0.286, μ_Derechos = 0.5/3.5 = 0.143
      // C = 0.571*100 + 0.286*50 + 0.143*0 = 57.1 + 14.3 + 0 = 71.4
      expect(result[0].affinityPercent).toBe(71.4)
    })
  })

  describe('Calibración omitida', () => {

    it('sin calibración → pesos iguales', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // 100%
        ['Q2', 0, 'approved']  // 50%
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      // Sin calibración → media simple: (100 + 50) / 2 = 75%
      expect(result[0].affinityPercent).toBe(75)
    })
  })

  describe('Cobertura por dimensión', () => {

    it('denominador = preguntas respondidas en esa dimensión', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'], ['Q3', 'economia'],
        ['Q4', 'social'], ['Q5', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], [2, 2, 2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 2, 'approved'] // solo 2 de 3 en Economía
        // Social: sin posiciones
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      const dimResult = result[0].dimensions.find(d => d.dimensionId === 'economia')!
      expect(dimResult.coveragePercent).toBe(66.7) // 2/3 respondidas en Economía
      expect(dimResult.answeredQuestionsInDimension).toBe(3)
    })

    it('cobertura global = evaluables / respondidas', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4'], [2, 2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 2, 'approved']
        // Social: sin posiciones
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].coveragePercent).toBe(50) // 2/4
    })

    it('cobertura por dimensión con usuario que responde 6 preguntas en 3 dimensiones', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social'],
        ['Q5', 'derechos'], ['Q6', 'derechos']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 1, -1, 0, 2, 1])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 1, 'approved'],
        ['Q5', 2, 'approved'], ['Q6', -1, 'approved']
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      const economia = result[0].dimensions.find(d => d.dimensionId === 'economia')!
      const derechos = result[0].dimensions.find(d => d.dimensionId === 'derechos')!
      expect(economia.coveragePercent).toBe(100) // 2/2
      expect(derechos.coveragePercent).toBe(100) // 2/2
      expect(result[0].dimensionsWithCoverage).toBe(2)
    })
  })

  describe('Determinismo', () => {

    it('mismos inputs → mismos resultados (1000 ejecuciones)', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'], ['Q3', 'social'],
        ['Q4', 'derechos'], ['Q5', 'medioambiente']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], [2, 1, 0, -1, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 1, 'approved'],
        ['Q3', 0, 'approved'], ['Q4', -1, 'approved'], ['Q5', 2, 'approved']
      ])
      const weights = makeWeights(['Q1', 'Q3', 'Q5'], ['high', 'medium', 'low'])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'serious',
        weights: { economia: 0.4, social: 0.2, derechos: 0.2, medioambiente: 0.2 }
      }

      const first = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES, calibration)
      for (let i = 1; i < 1000; i++) {
        const current = calculateScoring(answers, positions, weights, entities, questions, DIM_NAMES, calibration)
        expect(current[0].affinityPercent).toBe(first[0].affinityPercent)
      }
    })
  })

  describe('Invariancia por orden de entidades', () => {

    it('score de A no cambia al añadir B', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 1])
      const positions = [
        ...makePositions('A', [['Q1', 2, 'approved'], ['Q2', 1, 'approved']]),
        ...makePositions('B', [['Q1', -2, 'approved'], ['Q2', -1, 'approved']])
      ]
      const result1 = calculateScoring(answers, positions, [], [
        { entityId: 'A', historical: false }
      ], questions, DIM_NAMES)
      const result2 = calculateScoring(answers, positions, [], [
        { entityId: 'A', historical: false },
        { entityId: 'B', historical: false }
      ], questions, DIM_NAMES)
      expect(result1[0].affinityPercent).toBe(result2[0].affinityPercent)
    })

    it('todas las permutaciones de 5 entidades dan el mismo score por entidad', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const entityIds = ['A', 'B', 'C', 'D', 'E']
      const positions: Position[] = []
      for (const id of entityIds) {
        const val = entityIds.indexOf(id) // different values
        positions.push({ entityId: id, questionId: 'Q1', value: val, status: 'approved', evidenceRef: `e-${id}` })
      }
      const permutations: string[][] = [
        ['A', 'B', 'C', 'D', 'E'],
        ['E', 'D', 'C', 'B', 'A'],
        ['C', 'A', 'E', 'B', 'D'],
        ['B', 'D', 'A', 'E', 'C'],
        ['D', 'C', 'B', 'A', 'E']
      ]
      const firstScores: Record<string, number | null> = {}
      const entities1 = entityIds.map(id => ({ entityId: id, historical: false }))
      const result1 = calculateScoring(answers, positions, [], entities1, questions, DIM_NAMES)
      for (const r of result1) firstScores[r.entityId] = r.affinityPercent

      for (const perm of permutations) {
        const entities = perm.map(id => ({ entityId: id, historical: false }))
        const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
        for (const r of result) {
          expect(r.affinityPercent).toBe(firstScores[r.entityId])
        }
      }
    })
  })

  describe('Evidencias', () => {

    it('recoge evidenceRef de posiciones evaluables', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 2, 'approved']
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evidenceRefs).toContain('evidence-Q1')
      expect(result[0].evidenceRefs).toContain('evidence-Q2')
    })

    it('sin evidenceRef → array vacío', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = [{ entityId: 'A', questionId: 'Q1', value: 2, status: 'approved' as const }]
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].evidenceRefs).toEqual([])
    })
  })

  describe('Entidades históricas', () => {

    it('marca historical = true', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('H', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'H', historical: true }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].historical).toBe(true)
    })

    it('marca historical = false por defecto', () => {
      const questions = makeQuestions([['Q1', 'economia']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result[0].historical).toBe(false)
    })
  })

  describe('Dimensiones en resultados', () => {

    it('dimensiones ordenadas alfabéticamente por nombre', () => {
      const questions = makeQuestions([
        ['Q1', 'derechos'], ['Q2', 'economia'], ['Q3', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3'], [2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], ['Q2', 2, 'approved'], ['Q3', 2, 'approved']
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      const names = result[0].dimensions.map(d => d.dimensionName)
      expect(names).toEqual(['Derechos', 'Economía', 'Social'])
    })

    it('dimensiones sin nombre usan dimensionId', () => {
      const questions = makeQuestions([['Q1', 'desconocida']])
      const answers = makeAnswers(['Q1'], [2])
      const positions = makePositions('A', [['Q1', 2, 'approved']])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, {})
      expect(result[0].dimensions[0].dimensionName).toBe('desconocida')
    })
  })

  describe('Múltiples entidades', () => {

    it('cinco entidades con diferente cobertura', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'],
        ['Q3', 'social'], ['Q4', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4'], [2, 2, 2, 2])
      const positions: Position[] = [
        // A: todas aprobadas, todas coinciden
        ...makePositions('A', [['Q1', 2, 'approved'], ['Q2', 2, 'approved'], ['Q3', 2, 'approved'], ['Q4', 2, 'approved']]),
        // B: solo Economía
        ...makePositions('B', [['Q1', 2, 'approved'], ['Q2', 2, 'approved']]),
        // C: solo Social, desacuerdo
        ...makePositions('C', [['Q3', -2, 'approved'], ['Q4', -2, 'approved']]),
        // D: mixto
        ...makePositions('D', [['Q1', 2, 'approved'], ['Q4', -2, 'approved']]),
        // E: sin posiciones
      ]
      const entities = [
        { entityId: 'A', historical: false },
        { entityId: 'B', historical: false },
        { entityId: 'C', historical: false },
        { entityId: 'D', historical: false },
        { entityId: 'E', historical: false }
      ]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      expect(result.find(r => r.entityId === 'A')!.affinityPercent).toBe(100)
      expect(result.find(r => r.entityId === 'B')!.affinityPercent).toBe(100)
      expect(result.find(r => r.entityId === 'C')!.affinityPercent).toBe(0)
      expect(result.find(r => r.entityId === 'D')!.affinityPercent).toBe(50)
      expect(result.find(r => r.entityId === 'E')!.affinityPercent).toBeNull()
    })
  })

  describe('Sesgos y sensibilidad', () => {

    it('S-02: sesgo por ponderación — ranking no cambia', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions: Position[] = [
        ...makePositions('A', [['Q1', 2, 'approved'], ['Q2', 0, 'approved']]),
        ...makePositions('B', [['Q1', 0, 'approved'], ['Q2', 2, 'approved']])
      ]
      const weightsHigh = makeWeights(['Q1', 'Q2'], ['high', 'high'])
      const weightsLow = makeWeights(['Q1', 'Q2'], ['low', 'low'])
      const entities = [
        { entityId: 'A', historical: false },
        { entityId: 'B', historical: false }
      ]
      const resultHigh = calculateScoring(answers, positions, weightsHigh, entities, questions, DIM_NAMES)
      const resultLow = calculateScoring(answers, positions, weightsLow, entities, questions, DIM_NAMES)
      // Both should have same ranking: A > B
      const aHigh = resultHigh.find(r => r.entityId === 'A')!.affinityPercent!
      const bHigh = resultHigh.find(r => r.entityId === 'B')!.affinityPercent!
      const aLow = resultLow.find(r => r.entityId === 'A')!.affinityPercent!
      const bLow = resultLow.find(r => r.entityId === 'B')!.affinityPercent!
      expect(aHigh > bHigh).toBe(aLow > bLow)
    })

    it('S-04: invariancia por orden de entidades', () => {
      const questions = makeQuestions([['Q1', 'economia'], ['Q2', 'economia']])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 1])
      const positions = makePositions('A', [['Q1', 2, 'approved'], ['Q2', 1, 'approved']])
      const entities1 = [{ entityId: 'A', historical: false }]
      const entities2 = [
        { entityId: 'A', historical: false },
        { entityId: 'B', historical: false }
      ]
      const result1 = calculateScoring(answers, positions, [], entities1, questions, DIM_NAMES)
      const result2 = calculateScoring(answers, positions, [], entities2, questions, DIM_NAMES)
      expect(result1[0].affinityPercent).toBe(result2[0].affinityPercent)
    })
  })

  describe('Question → Dimension mapping', () => {

    it('6 dimensiones con calibración seria y entidad en 2 dimensiones', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social'], ['Q3', 'derechos'],
        ['Q4', 'medioambiente'], ['Q5', 'seguridad'], ['Q6', 'educacion']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], [2, 2, 2, 2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // Economía: 100%
        ['Q3', -2, 'approved'] // Derechos: 0%
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'serious',
        weights: { economia: 0.3, social: 0.1, derechos: 0.2, medioambiente: 0.2, seguridad: 0.1, educacion: 0.1 }
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      // Renormalización: sum_λ = 0.3 + 0.2 = 0.5
      // μ_Economía = 0.3/0.5 = 0.6, μ_Derechos = 0.2/0.5 = 0.4
      // C = 0.6*100 + 0.4*0 = 60%
      expect(result[0].affinityPercent).toBe(60)
      expect(result[0].dimensionsWithCoverage).toBe(2)
      expect(result[0].totalDimensions).toBe(6)
    })

    it('calibración con peso 0 en dimensión evaluable → renormalización correcta', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // 100%
        ['Q2', 2, 'approved']  // 100%
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'serious',
        weights: { economia: 0, social: 0.5 }
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      // Renormalización: sum_λ = 0 + 0.5 = 0.5
      // μ_Economía = 0/0.5 = 0, μ_Social = 0.5/0.5 = 1
      // C = 0*100 + 1*100 = 100%
      expect(result[0].affinityPercent).toBe(100)
    })

    it('todas las dimensiones con peso 0 → fallback a pesos iguales', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2'], [2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'], // 100%
        ['Q2', 0, 'approved']  // 50%
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const calibration: DimensionCalibration = {
        mode: 'serious',
        weights: { economia: 0, social: 0 }
      }
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES, calibration)
      // Fallback: (100 + 50) / 2 = 75%
      expect(result[0].affinityPercent).toBe(75)
    })

    it('la dimensión de cada pregunta viene del banco de preguntas, no de las posiciones', () => {
      // This tests the fix for the coverage denominator issue
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'], ['Q3', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3'], [2, 2, 2])
      // Entity has no positions at all, but user answered 3 questions in 2 dimensions
      const positions: Position[] = []
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      // Entity has no evaluable questions, but totalDimensions should be 2 (economia, social)
      expect(result[0].totalDimensions).toBe(2)
      expect(result[0].affinityPercent).toBeNull()
    })

    it('cobertura por dimensión correcta cuando ninguna entidad tiene posición en una pregunta', () => {
      const questions = makeQuestions([
        ['Q1', 'economia'], ['Q2', 'economia'], ['Q3', 'social']
      ])
      const answers = makeAnswers(['Q1', 'Q2', 'Q3'], [2, 2, 2])
      const positions = makePositions('A', [
        ['Q1', 2, 'approved'] // solo Q1 en Economía
      ])
      const entities = [{ entityId: 'A', historical: false }]
      const result = calculateScoring(answers, positions, [], entities, questions, DIM_NAMES)
      const economia = result[0].dimensions.find(d => d.dimensionId === 'economia')!
      // answeredInDim should be 2 (Q1, Q2), evaluable should be 1 (Q1)
      expect(economia.answeredQuestionsInDimension).toBe(2)
      expect(economia.evaluableQuestions).toBe(1)
      expect(economia.coveragePercent).toBe(50) // 1/2
    })
  })
})
