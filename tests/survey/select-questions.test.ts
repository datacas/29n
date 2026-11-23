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
  it('sin el modo exhaustivo, el selector no cambia: equivale a pasar exhaustive=false', () => {
    for (const m of ['quick', 'normal', 'deep'] as const) {
      expect(ids(selectQuestions(questions, positions, entities, [], m))).toEqual(ids(selectQuestions(questions, positions, entities, [], m, undefined, false)))
    }
  })
})

// Datos reales del 29N: fija cuántas preguntas da cada profundidad, para detectar cualquier cambio en el selector general.
// (Comprobado al introducir el modo exhaustivo: mismas listas que el selector anterior en 9 combinaciones.)
import { readFileSync, existsSync } from 'node:fs'
const REL = 'app/public/data/releases/89580f79-3955-469f-99be-2709a5611956.json'
describe.skipIf(!existsSync(REL))('29N con datos reales', () => {
  const d = existsSync(REL) ? JSON.parse(readFileSync(REL, 'utf8')) : null
  it('rápida 27, normal 43, completa 67 con todos los partidos', () => {
    const n = (m: 'quick' | 'normal' | 'deep') => selectQuestions(d.questions, d.positions, d.entities, [], m).length
    expect([n('quick'), n('normal'), n('deep')]).toEqual([27, 43, 67])
  })
})
