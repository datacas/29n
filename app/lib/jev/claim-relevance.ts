/**
 * SPIKE-12: filtro de relevancia POR CITA. Una petición por cita, para detectar citas que
 * solo comparten palabras con la proposición (p. ej. "reformaremos la Ley de Montes" frente a
 * "¿reformar el sistema electoral?"). Solo mide; no borra ni cambia nada.
 */
import type { JevClient, QuestionSpec } from './client.ts'
import type { NoulAnswer, SystemOneAnswer } from './types.ts'

export interface ClaimRelevanceInput {
  questionText: string
  party: string
  literalText: string
  sourcePage?: number | null
}

export function buildClaimState(i: ClaimRelevanceInput): Record<string, unknown> {
  return {
    proposicion: i.questionText,
    partido: i.party,
    cita_literal: i.literalText,
    pagina: i.sourcePage ?? null
  }
}

export const CLAIM_QUESTIONS: Record<string, QuestionSpec> = {
  relevant: {
    type: 'noul',
    instructions:
      'La cita literal se pronuncia directamente sobre la proposición, ya sea a favor, en contra o con matices. ' +
      'Responde NO si solo trata un tema cercano, menciona palabras parecidas (como "reformar" o "participación") ' +
      'o habla de otra política distinta.'
  }
}

export interface ClaimRelevance {
  /** P(la cita responde a la proposición); null si Jev se negó a contestar */
  pRelevant: number | null
}

export function parseClaimRelevance(answers: Record<string, SystemOneAnswer>): ClaimRelevance {
  const a = answers.relevant
  return { pRelevant: a && a.type === 'noul' ? (a as NoulAnswer).noul : null }
}

export async function assessClaim(client: JevClient, i: ClaimRelevanceInput) {
  const result = await client.systemOne(buildClaimState(i), CLAIM_QUESTIONS)
  return { ...parseClaimRelevance(result.answers), result }
}
