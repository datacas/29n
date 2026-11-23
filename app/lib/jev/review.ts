import type { JevClient, QuestionSpec } from './client.ts'
import type {
  ChoiceAnswer,
  JevMode,
  JevStanceChoice,
  JevRelevanceChoice,
  JevVerdict,
  NoulAnswer,
  PositionInput,
  StanceClass,
  SystemOneAnswer,
  SystemOneResult
} from './types.ts'

const NO_CONDITIONS = /^(ning[uú]n[ao]?\b.*|no (se )?(hay|mencion|especific|indic|exist)\w*\b.*|sin condicion\w*.*|—|-|n\/a)$/i

export function hasRealConditions(c?: string | null): boolean {
  return !!c && c.trim().length > 0 && !NO_CONDITIONS.test(c.trim())
}

/** Estado enviado a Jev: texto literal y contexto; el orden de las citas no importa. */
export function buildState(p: PositionInput, mode: JevMode): Record<string, unknown> {
  const state: Record<string, unknown> = {
    proposicion: p.questionText,
    partido: p.party,
    citas: p.claims.map((c, i) => ({
      n: i + 1,
      cita_literal: c.literalText,
      pagina: c.sourcePage ?? null,
      condiciones: hasRealConditions(c.conditions) ? c.conditions : 'ninguna'
    }))
  }
  if (mode === 'with_proposal') {
    state.posicion_propuesta = {
      estado: p.proposedStanceStatus ?? 'desconocido',
      posturas_por_cita: p.claims.map((c) => c.claudeStance ?? 'desconocida')
    }
  }
  return state
}

export function buildQuestions(mode: JevMode): Record<string, QuestionSpec> {
  const q: Record<string, QuestionSpec> = {
    relevance: {
      type: 'choice',
      instructions:
        'Las citas son textos literales de un programa electoral. ¿Responden a la proposición del campo "proposicion"?',
      criteria: {
        direct: 'Alguna cita se pronuncia de forma directa sobre la proposición.',
        tangential: 'Las citas tratan el tema pero no se pronuncian sobre la proposición concreta.',
        unrelated: 'Las citas no tienen relación con la proposición.'
      }
    },
    stance: {
      type: 'choice',
      instructions:
        'Según SOLO las citas literales, ¿cuál es la postura del partido ante la proposición? Se mide respecto a la proposición tal como está formulada.',
      criteria: {
        supports: 'Las citas expresan apoyo claro a la proposición, sin condiciones que lo cambien.',
        opposes: 'Las citas expresan oposición clara a la proposición.',
        conditional: 'Hay apoyo u oposición, pero sujeto a condiciones, matices o alcance limitado relevantes.',
        unclear: 'Las citas no permiten determinar la postura, o son demasiado vagas o genéricas.'
      }
    },
    evidence_sufficient: {
      type: 'noul',
      instructions: '¿Es suficiente la evidencia citada para sostener una postura concreta ante la proposición?'
    },
    contradiction: {
      type: 'noul',
      instructions: '¿Se contradicen entre sí dos o más de las citas respecto a la proposición?'
    },
    condition_material: {
      type: 'noul',
      instructions:
        '¿Hay condiciones, excepciones o matices en las citas que cambian de forma material cómo se debe leer la postura?'
    }
  }
  if (mode === 'with_proposal') {
    q.proposal_matches = {
      type: 'noul',
      instructions:
        'La "posicion_propuesta" es coherente con lo que dicen las citas literales respecto a la proposición.'
    }
  }
  return q
}

function isChoice(a: SystemOneAnswer | undefined): a is ChoiceAnswer {
  return !!a && a.type === 'choice'
}
function isNoul(a: SystemOneAnswer | undefined): a is NoulAnswer {
  return !!a && a.type === 'noul'
}

const RELEVANCE_VALUES: JevRelevanceChoice[] = ['direct', 'tangential', 'unrelated']
const STANCE_VALUES: JevStanceChoice[] = ['supports', 'opposes', 'conditional', 'unclear']

/** Interpreta la respuesta tipada. Una pregunta rechazada o inesperada cuenta como abstención. */
export function parseVerdict(answers: Record<string, SystemOneAnswer>): JevVerdict {
  const refusals: string[] = []
  const noul = (key: string): number | null => {
    const a = answers[key]
    if (isNoul(a)) return a.noul
    if (a?.type === 'refusal') refusals.push(key)
    return null
  }
  const rel = answers.relevance
  const st = answers.stance
  if (rel?.type === 'refusal') refusals.push('relevance')
  if (st?.type === 'refusal') refusals.push('stance')

  const relChoice =
    isChoice(rel) && (RELEVANCE_VALUES as string[]).includes(rel.choice)
      ? (rel.choice as JevRelevanceChoice)
      : 'abstain'
  const stChoice =
    isChoice(st) && (STANCE_VALUES as string[]).includes(st.choice)
      ? (st.choice as JevStanceChoice)
      : 'abstain'

  return {
    relevance: relChoice,
    relevanceProbs: isChoice(rel) ? rel.probabilities : {},
    stance: stChoice,
    stanceProbs: isChoice(st) ? st.probabilities : {},
    stanceConfidence: isChoice(st) ? st.confidence : 0,
    evidenceSufficientP: noul('evidence_sufficient'),
    contradictionP: noul('contradiction'),
    conditionMaterialP: noul('condition_material'),
    // Ya no se pregunta (SPIKE-12: marcaba 65/68 posiciones, no discrimina). Se conserva por compatibilidad con registros antiguos.
    needsReviewP: noul('needs_human_review'),
    proposalMatchesP: noul('proposal_matches'),
    refusals
  }
}

export interface JevThresholds {
  /** P(contradicción) a partir de la cual se declara 'contradictory' */
  contradiction: number
  /** confianza mínima de la postura para no abstenerse */
  stanceConfidence: number
}

export const DEFAULT_THRESHOLDS: JevThresholds = { contradiction: 0.5, stanceConfidence: 0.5 }

/**
 * Clase final de Jev para comparar con etiquetas humanas.
 * Devuelve null cuando Jev se abstiene (rechazo o confianza baja).
 */
export function jevPredictedClass(v: JevVerdict, t: JevThresholds = DEFAULT_THRESHOLDS): StanceClass | null {
  if (v.contradictionP !== null && v.contradictionP >= t.contradiction) return 'contradictory'
  if (v.stance === 'abstain') return null
  if (v.stanceConfidence < t.stanceConfidence) return null
  return v.stance
}

/** Mapa de las etiquetas de stance de Claude (evidence_jsonb) a las clases comunes. */
export function claudeClaimClass(stance?: string | null): StanceClass {
  switch (stance) {
    case 'agrees':
      return 'supports'
    case 'disagrees':
      return 'opposes'
    case 'conditional_agrees':
    case 'conditional':
      return 'conditional'
    default:
      return 'unclear'
  }
}

/** Postura de Claude a nivel de posición, agregando sus citas. */
export function claudePositionClass(p: PositionInput): StanceClass {
  const classes = p.claims.map((c) => claudeClaimClass(c.claudeStance))
  if (classes.length === 0) return 'unclear'
  const has = (c: StanceClass) => classes.includes(c)
  if (has('supports') && has('opposes')) return 'contradictory'
  const counts = new Map<StanceClass, number>()
  for (const c of classes) counts.set(c, (counts.get(c) ?? 0) + 1)
  // Una cita determinada (supports/opposes/conditional) pesa más que 'unclear'
  const informative = [...counts.entries()].filter(([c]) => c !== 'unclear')
  if (informative.length === 0) return 'unclear'
  informative.sort((a, b) => b[1] - a[1])
  if (informative.length > 1 && informative[0][1] === informative[1][1]) return 'unclear'
  return informative[0][0]
}

export interface JevRun {
  verdict: JevVerdict
  result: SystemOneResult
  mode: JevMode
}

/** Una posición = una petición con todas las preguntas tipadas. */
export async function reviewPosition(client: JevClient, p: PositionInput, mode: JevMode): Promise<JevRun> {
  const result = await client.systemOne(buildState(p, mode), buildQuestions(mode))
  return { verdict: parseVerdict(result.answers), result, mode }
}
