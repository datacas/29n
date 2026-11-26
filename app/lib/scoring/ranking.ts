/**
 * Reglas de presentación del ranking de resultados.
 *
 * Un porcentaje calculado sobre muy pocas preguntas es inestable: con 5-6 posiciones
 * documentadas, una sola respuesta mueve el resultado más de 10 puntos y puede colocar
 * a un partido en cabeza por azar. Para que la cobertura no se convierta en una ventaja,
 * los resultados con poca muestra se marcan y se ordenan al final, después de los que
 * tienen base suficiente.
 *
 * No se oculta ningún resultado ni se penaliza el porcentaje mostrado: el número sigue
 * siendo la compatibilidad real sobre las preguntas evaluables.
 */

export interface RankableResult {
  affinityPercent: number | null
  evaluableQuestions: number
  answeredQuestions: number
  coveragePercent: number
}

/**
 * Cobertura mínima (sobre preguntas contestadas) para considerar fiable un resultado. Configurable por encuesta:
 * en una exhaustiva, con preguntas de un solo programa, la cobertura de cada uno es baja por diseño y manda el mínimo absoluto.
 */
export const MIN_COVERAGE_PERCENT = 25

/**
 * Mínimo absoluto de preguntas evaluables para no considerarlo "pocos datos".
 * Cada encuesta puede fijar el suyo (consultation.minEvaluableQuestions): la histórica usa 5 porque sus
 * documentos son cortos y con 8 casi todos saldrían marcados; el 29N usa este valor por defecto.
 */
export const MIN_EVALUABLE_QUESTIONS = 8

export function minEvaluableFor(result: RankableResult, min: number = MIN_EVALUABLE_QUESTIONS): number {
  // Si la persona ha contestado menos preguntas que el mínimo, no se puede exigir más de las que hay.
  return Math.min(min, result.answeredQuestions)
}

export function isLowCoverage(result: RankableResult, min: number = MIN_EVALUABLE_QUESTIONS, minCoverage: number = MIN_COVERAGE_PERCENT): boolean {
  if (result.affinityPercent === null) return false
  return (
    result.coveragePercent < minCoverage ||
    result.evaluableQuestions < minEvaluableFor(result, min)
  )
}

/**
 * Ordena de más a menos compatibilidad, pero:
 *  - los resultados con pocos datos van al final, aunque su porcentaje sea alto;
 *  - los que no tienen ninguna posición documentada van al final del todo.
 * El orden es estable para que dos ejecuciones den el mismo resultado.
 */
export function sortResults<T extends RankableResult>(results: T[], min: number = MIN_EVALUABLE_QUESTIONS, minCoverage: number = MIN_COVERAGE_PERCENT): T[] {
  const rank = (r: RankableResult) => (r.affinityPercent === null ? 2 : isLowCoverage(r, min, minCoverage) ? 1 : 0)
  return [...results].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    return (b.affinityPercent ?? 0) - (a.affinityPercent ?? 0)
  })
}

/**
 * Diferencia pequeña entre los primeros puestos.
 * Umbral: 3 puntos de afinidad. Se estimó con usuarios sintéticos y pesos iguales sobre la versión 2.2.1: con un hueco menor de 3 puntos entre el 1.º y el 2.º,
 * quitar una sola pregunta cambia el primer partido en más del 12 % de los casos; con 3-5 puntos baja al 7 % y por encima de 8 puntos al 2 %.
 * Solo se aplica al primer puesto: el grupo se mide desde su primer miembro (sin encadenar) y los resultados con «pocos datos» no entran.
 */
export const SMALL_DIFFERENCE_POINTS = 3

export function leadingGroup<T extends { entityId: string; affinityPercent: number | null }>(
  sorted: T[],
  isCandidate: (r: T) => boolean,
  threshold: number = SMALL_DIFFERENCE_POINTS
): Set<string> {
  const head = sorted.find((r) => r.affinityPercent !== null && isCandidate(r))
  if (!head) return new Set()
  const ids = sorted.filter((r) => r.affinityPercent !== null && isCandidate(r) && (head.affinityPercent as number) - (r.affinityPercent as number) < threshold).map((r) => r.entityId)
  return ids.length >= 2 ? new Set(ids) : new Set()
}
