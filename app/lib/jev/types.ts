/**
 * SPIKE-12: Jev como revisor editorial auxiliar (experimental, solo lectura).
 * Nada de este módulo aprueba, rechaza ni publica posiciones.
 */

/** Clases de postura comparables entre humano, Claude y Jev. */
export type StanceClass = 'supports' | 'opposes' | 'conditional' | 'unclear' | 'contradictory'

export const STANCE_CLASSES: readonly StanceClass[] = [
  'supports',
  'opposes',
  'conditional',
  'unclear',
  'contradictory'
] as const

/** Lo que Jev puede elegir como postura (la contradicción sale de otra pregunta). */
export type JevStanceChoice = 'supports' | 'opposes' | 'conditional' | 'unclear'
export type JevRelevanceChoice = 'direct' | 'tangential' | 'unrelated'

export interface ClaimInput {
  literalText: string
  normalizedText?: string | null
  conditions?: string | null
  sourcePage?: number | null
  /** Etiqueta original de Claude (stance de evidence_jsonb), no es verdad de referencia. */
  claudeStance?: string | null
}

export interface PositionInput {
  positionId: string
  party: string
  questionId: string
  questionText: string
  claims: ClaimInput[]
  /** Estado de la posición propuesta por el pipeline (Claude). */
  proposedStanceStatus?: string | null
}

export type JevMode = 'independent' | 'with_proposal'

export interface ChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}
export interface NoulAnswer {
  type: 'noul'
  noul: number
}
export interface ScoreAnswer {
  type: 'score'
  score: number
  confidence?: number
  probabilities?: Record<string, number>
}
export interface RefusalAnswer {
  type: 'refusal'
}
export type SystemOneAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer | RefusalAnswer

export interface SystemOneUsage {
  input_tokens: number
  output_tokens: number
}

export interface SystemOneResult {
  model: string
  answers: Record<string, SystemOneAnswer>
  usage: SystemOneUsage
  latencyMs: number
}

/** Decisión de Jev ya interpretada. Las probabilidades se conservan tal cual. */
export interface JevVerdict {
  relevance: JevRelevanceChoice | 'abstain'
  relevanceProbs: Record<string, number>
  stance: JevStanceChoice | 'abstain'
  stanceProbs: Record<string, number>
  stanceConfidence: number
  /** P(la evidencia basta para sostener la postura) */
  evidenceSufficientP: number | null
  /** P(las citas se contradicen entre sí) */
  contradictionP: number | null
  /** P(hace falta revisión humana) */
  needsReviewP: number | null
  /** P(las condiciones cambian materialmente la postura) */
  conditionMaterialP: number | null
  /** Solo en modo with_proposal: P(la posición propuesta es correcta) */
  proposalMatchesP: number | null
  /** Preguntas que Jev rechazó contestar */
  refusals: string[]
}

export type QuoteStatus = 'exact' | 'fuzzy' | 'not_found' | 'no_source'

export type TriageGroup = 'high_confidence' | 'doubtful' | 'contradictory'

export interface TriageResult {
  group: TriageGroup
  reasons: string[]
}

export interface HumanLabel {
  positionId: string
  stance: StanceClass
  evidenceSufficient?: boolean
  annotator: string
  notes?: string
}
