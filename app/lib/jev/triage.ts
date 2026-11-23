import type { JevVerdict, QuoteStatus, StanceClass, TriageResult } from './types.ts'

export interface TriageInput {
  verdict: JevVerdict
  /**
   * Postura que propuso Claude. Se conserva por compatibilidad, pero YA NO influye en el triaje:
   * en el benchmark contra decisiones editoriales (n=60, evidencia del extractor original) su señal
   * era ≈ azar (AUC 0,52), mientras que la pertinencia y la suficiencia de Jev anticipaban los
   * rechazos con AUC 0,91-0,92.
   */
  claudeClass?: StanceClass
  /** Resultado de verificar cada cita contra el PDF */
  quoteStatuses: QuoteStatus[]
}

export interface TriageThresholds {
  contradiction: number
  evidenceSufficient: number
}

export const DEFAULT_TRIAGE: TriageThresholds = {
  contradiction: 0.5,
  evidenceSufficient: 0.5
}

/**
 * Prioriza la revisión humana. NO decide nada: solo ordena el trabajo.
 *
 *  - contradictory ("Conflicto"): una cita no aparece en el PDF, o Jev ve citas que se contradicen.
 *  - doubtful ("Revisar con cuidado"): Jev no ve la evidencia como pertinente directa o suficiente,
 *    o hay citas no verificables / solo aproximadas.
 *  - high_confidence ("Revisión rápida"): Jev la ve pertinente directa y suficiente, y las citas
 *    están verificadas. En el benchmark (n=55 originales) 27 posiciones cumplían esto y solo 1 se rechazó.
 */
export function triage(input: TriageInput, t: TriageThresholds = DEFAULT_TRIAGE): TriageResult {
  const { verdict: v, quoteStatuses } = input
  const hard: string[] = []
  const soft: string[] = []

  if (quoteStatuses.includes('not_found')) hard.push('Alguna cita no aparece en el PDF')
  if (v.contradictionP !== null && v.contradictionP >= t.contradiction) {
    hard.push(`Jev detecta contradicción entre citas (p=${v.contradictionP.toFixed(2)})`)
  }

  if (v.relevance !== 'direct') soft.push(`Relevancia: ${v.relevance === 'abstain' ? 'Jev no contesta' : v.relevance}`)
  if (v.evidenceSufficientP === null) soft.push('Sin dato de suficiencia de evidencia')
  else if (v.evidenceSufficientP < t.evidenceSufficient) {
    soft.push(`Evidencia insuficiente según Jev (p suficiente=${v.evidenceSufficientP.toFixed(2)})`)
  }
  if (quoteStatuses.includes('no_source')) soft.push('Cita no verificable: falta el texto del PDF')
  if (quoteStatuses.includes('fuzzy')) soft.push('Cita verificada solo de forma aproximada')
  if (quoteStatuses.length === 0) soft.push('Sin citas')

  if (hard.length) return { group: 'contradictory', reasons: [...hard, ...soft] }
  if (soft.length) return { group: 'doubtful', reasons: soft }
  return { group: 'high_confidence', reasons: ['Jev la ve pertinente y suficiente; citas verificadas'] }
}
