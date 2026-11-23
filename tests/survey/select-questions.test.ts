import { describe, it, expect } from 'vitest'
import { selectQuestions } from '../../app/lib/survey/select-questions.ts'

// Banco exhaustivo: q1 comparativa (nivel 1), q2 de dos programas (nivel 2), q3 y q4 de un solo programa (nivel 3)
const questions = [
  { questionId: 'q1', depthLevel: 1, dimensionCode: 'd' },
  { questionId: 'q2', depthLevel: 2, dimensionCode: 'd' },
  { questionId: 'q3', depthLevel: 3, dimensionCode: 'd' },
  { questionId: 'q4', depthLevel: 3, dimensionCode: 'd' }
]
const pos = (entityId: string, questionId: string, value: number | null = 2, stanceStatus = 'approved') => ({ entityId, questionId, value, stanceStatus })
const positions = [
  pos('A', 'q1'), pos('B', 'q1'), pos('C', 'q1'),
  pos('A', 'q2'), pos('B', 'q2', -2),
  pos('A', 'q3'),
  pos('C', 'q4', null, 'ambiguous')
]
const entities = ['A', 'B', 'C'].map((id) => ({ entityId: id, name: id }))
const ids = (qs: { questionId: string }[]) => qs.map((q) => q.questionId)

describe('selección exhaustiva (encuesta histórica)', () => {
  it('rápida: solo las comparativas (nivel 1)', () => {
    expect(ids(selectQuestions(questions, positions, entities, [], 'quick', undefined, true))).toEqual(['q1'])
  })
  it('normal: hasta nivel 2', () => {
    expect(ids(selectQuestions(questions, positions, entities, [], 'normal', undefined, true))).toEqual(['q1', 'q2'])
  })
  it('completa: todas las que tienen alguna posición que puntúa (la ambigua no basta)', () => {
    expect(ids(selectQuestions(questions, positions, entities, [], 'deep', undefined, true))).toEqual(['q1', 'q2', 'q3'])
  })
  it('una pregunta de un solo programa no sale si ese programa no está elegido', () => {
    expect(ids(selectQuestions(questions, positions, entities, ['B', 'C'], 'deep', undefined, true))).toEqual(['q1', 'q2'])
  })
  it('sin el modo exhaustivo, el comportamiento del 29N no cambia', () => {
    const normal = ids(selectQuestions(questions, positions, entities, [], 'quick'))
    expect(normal).toContain('q1')
  })
})
