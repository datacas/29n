/**
 * Convierte lo que la persona contestó en la lista que usa el cálculo.
 * «No sé / Sin opinión» (0), una pregunta sin tocar y una omitida NO cuentan: no puntúan a nadie.
 * Así, indecisión no premia a los partidos cuyas posiciones están codificadas con más suavidad.
 */
export interface AnswerInput { questionId: string }
export interface BuiltAnswer { questionId: string; value: number; skipped: boolean }

export function buildAnswerArray(
  questions: AnswerInput[],
  answers: Record<string, number | null | undefined>,
  skipped: Set<string>
): BuiltAnswer[] {
  return questions.map((q) => {
    const raw = answers[q.questionId]
    const noOpinion = raw === undefined || raw === null || raw === 0
    return { questionId: q.questionId, value: raw ?? 0, skipped: skipped.has(q.questionId) || noOpinion }
  })
}
