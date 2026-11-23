/**
 * SPIKE-12: sugerencia de Jev para la postura (-2..+2) de una posición aprobada.
 * Solo informativa; la decisión es humana (positions.value).
 */
import type { JevClient, QuestionSpec } from './client.ts'
import { hasRealConditions } from './review.ts'
import type { ChoiceAnswer, PositionInput, SystemOneAnswer } from './types.ts'

export type ValueChoiceKey =
  | 'strongly_for' | 'partially_for' | 'neutral_explicit' | 'partially_against' | 'strongly_against' | 'contradictory'

export const CHOICE_TO_VALUE: Record<ValueChoiceKey, number | null> = {
  strongly_for: 2, partially_for: 1, neutral_explicit: 0, partially_against: -1, strongly_against: -2, contradictory: null
}

export const VALUE_QUESTION: Record<string, QuestionSpec> = {
  position: {
    type: 'choice',
    instructions:
      'Según SOLO las citas literales del programa, ¿cuál es la postura del partido ante la proposición, tal como está formulada? ' +
      'No infieras neutralidad por falta de información: elige "neutral_explicit" solo si el texto declara expresamente no tomar partido.',
    criteria: {
      strongly_for: 'Las citas apoyan la proposición de forma explícita y sin reservas relevantes.',
      partially_for: 'Las citas apoyan la proposición solo en parte, con matices, condiciones o alcance limitado.',
      neutral_explicit: 'Las citas declaran expresamente neutralidad o presentan ambas opciones sin preferencia.',
      partially_against: 'Las citas se oponen a la proposición solo en parte, con matices, condiciones o alcance limitado.',
      strongly_against: 'Las citas se oponen a la proposición de forma explícita.',
      contradictory: 'Las citas se contradicen entre sí respecto a la proposición.'
    }
  }
}

export function buildValueState(p: PositionInput): Record<string, unknown> {
  return {
    proposicion: p.questionText,
    partido: p.party,
    citas: p.claims.map((c, i) => ({
      n: i + 1,
      cita_literal: c.literalText,
      pagina: c.sourcePage ?? null,
      condiciones: hasRealConditions(c.conditions) ? c.conditions : 'ninguna'
    }))
  }
}

export interface ValueSuggestion {
  choice: ValueChoiceKey | null
  value: number | null
  confidence: number | null
  probabilities: Record<string, number>
}

export function parseValueSuggestion(answers: Record<string, SystemOneAnswer>): ValueSuggestion {
  const a = answers.position
  if (!a || a.type !== 'choice' || !(a.choice in CHOICE_TO_VALUE)) {
    return { choice: null, value: null, confidence: null, probabilities: {} }
  }
  const c = a as ChoiceAnswer
  const key = c.choice as ValueChoiceKey
  return { choice: key, value: CHOICE_TO_VALUE[key], confidence: c.confidence, probabilities: c.probabilities }
}

export async function suggestValue(client: JevClient, p: PositionInput) {
  const result = await client.systemOne(buildValueState(p), VALUE_QUESTION)
  return { ...parseValueSuggestion(result.answers), result }
}
