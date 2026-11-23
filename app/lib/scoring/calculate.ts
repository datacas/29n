// Scoring engine — pure TypeScript, runs 100% in browser
// Multidimensional weighted compatibility with renormalization
// See scoring-methodology.md section 4 for the formula

// --- Types ---

export interface Answer {
  questionId: string
  value: number // [-2, 2]
  skipped: boolean
}

export type PositionStatus =
  | 'approved' | 'explicit_neutral' | 'conditional'
  | 'unknown' | 'not_stated' | 'not_comparable'
  | 'ambiguous' | 'conflicting_sources'

export interface Position {
  entityId: string
  questionId: string
  value: number // [-2, 2]
  status: PositionStatus
  conditions?: string
  evidenceRef?: string
}

export interface Question {
  questionId: string
  dimensionId: string
}

export interface Weight {
  questionId: string
  importance: 'low' | 'medium' | 'high'
}

export interface DimensionCalibration {
  mode: 'serious' | 'quick' | 'skipped'
  weights: Record<string, number>
}

export interface EntityInfo {
  entityId: string
  historical: boolean
}

export interface DimensionResult {
  dimensionId: string
  dimensionName: string
  affinityPercent: number
  evaluableQuestions: number
  answeredQuestionsInDimension: number
  coveragePercent: number
}

export interface ScoringResult {
  entityId: string
  affinityPercent: number | null
  evaluableQuestions: number
  answeredQuestions: number
  coveragePercent: number
  dimensions: DimensionResult[]
  evidenceRefs: string[]
  historical: boolean
  dimensionsWithCoverage: number
  totalDimensions: number
}

// --- Constants ---

const WEIGHT_MAP: Record<string, number> = { low: 0.5, medium: 1.0, high: 2.0 }

const EVALUABLE_STATUSES = new Set<PositionStatus>([
  'approved', 'explicit_neutral', 'conditional'
])

// --- Core functions ---

function proximity(userValue: number, positionValue: number): number {
  return 1 - Math.abs(userValue - positionValue) / 4
}

function getWeight(weights: Weight[], questionId: string): number {
  const w = weights.find(w => w.questionId === questionId)
  return WEIGHT_MAP[w?.importance] ?? WEIGHT_MAP['medium']
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function calculateScoring(
  answers: Answer[],
  positions: Position[],
  weights: Weight[],
  entities: EntityInfo[],
  questions: Question[],
  dimensionNames: Record<string, string>,
  calibration?: DimensionCalibration
): ScoringResult[] {
  const answered = answers.filter(a => !a.skipped)

  // Build question → dimension map from question bank (not from positions)
  const questionDimension = new Map<string, string>()
  for (const q of questions) {
    questionDimension.set(q.questionId, q.dimensionId)
  }

  // All dimensions in the release
  const allDimensionIds = new Set(questions.map(q => q.dimensionId))
  const totalDimensions = allDimensionIds.size

  // Count answered questions per dimension (denominator for coverage per dimension)
  const answeredByDimension = new Map<string, Set<string>>()
  for (const answer of answered) {
    const dimId = questionDimension.get(answer.questionId)
    if (dimId == null) continue
    if (!answeredByDimension.has(dimId))
      answeredByDimension.set(dimId, new Set())
    answeredByDimension.get(dimId)!.add(answer.questionId)
  }

  // Group positions by entity and dimension
  // entityData[entityId][dimensionId] = array of { proximity, weight, questionId, evidenceRef }
  const entityData = new Map<string, Map<string, Array<{
    proximity: number
    weight: number
    questionId: string
    evidenceRef?: string
  }>>>()

  // Initialize all entities (including those without evaluable positions)
  for (const entity of entities) {
    entityData.set(entity.entityId, new Map())
  }

  // Process answers against positions
  for (const answer of answered) {
    if (answer.skipped) continue
    const weight = getWeight(weights, answer.questionId)
    const dimId = questionDimension.get(answer.questionId)
    if (dimId == null) continue

    for (const pos of positions) {
      if (pos.questionId !== answer.questionId) continue
      if (!EVALUABLE_STATUSES.has(pos.status)) continue

      const entityMap = entityData.get(pos.entityId)
      if (!entityMap) continue

      const dimEntries = entityMap.get(dimId) || []
      dimEntries.push({
        proximity: proximity(answer.value, pos.value),
        weight,
        questionId: answer.questionId,
        evidenceRef: pos.evidenceRef
      })
      entityMap.set(dimId, dimEntries)
    }
  }

  // Calculate results per entity
  return Array.from(entityData.entries()).map(([entityId, data]) => {
    const dimensionResults: DimensionResult[] = []
    const allEvidenceRefs: string[] = []
    let totalEvaluable = 0
    const evaluableDimIds = new Set<string>()

    for (const [dimId, entries] of data) {
      if (entries.length === 0) continue

      const numerator = entries.reduce((sum, e) => sum + e.weight * e.proximity, 0)
      const denominator = entries.reduce((sum, e) => sum + e.weight, 0)
      const dimAffinity = denominator > 0
        ? round1((numerator / denominator) * 100)
        : 0

      // Coverage per dimension: denominator = answered questions in this dimension
      const answeredInDim = answeredByDimension.get(dimId)?.size || 0
      const dimCoverage = answeredInDim > 0
        ? round1((entries.length / answeredInDim) * 100)
        : 0

      dimensionResults.push({
        dimensionId: dimId,
        dimensionName: dimensionNames[dimId] || dimId,
        affinityPercent: dimAffinity,
        evaluableQuestions: entries.length,
        answeredQuestionsInDimension: answeredInDim,
        coveragePercent: dimCoverage
      })

      evaluableDimIds.add(dimId)
      totalEvaluable += entries.length

      for (const e of entries) {
        if (e.evidenceRef && !allEvidenceRefs.includes(e.evidenceRef)) {
          allEvidenceRefs.push(e.evidenceRef)
        }
      }
    }

    // Global score: weighted mean with renormalization among evaluable dimensions
    let affinityPercent: number | null = null
    if (evaluableDimIds.size > 0) {
      if (calibration && calibration.weights) {
        // Renormalize λ among evaluable dimensions of this entity
        const sumLambda = Array.from(evaluableDimIds).reduce(
          (sum, d) => sum + (calibration.weights[d] || 0), 0
        )

        if (sumLambda > 0) {
          const weightedSum = dimensionResults.reduce((sum, dim) => {
            const lambda = calibration.weights[dim.dimensionId] || 0
            const mu = lambda / sumLambda // renormalized weight
            return sum + mu * dim.affinityPercent
          }, 0)
          affinityPercent = round1(weightedSum)
        } else {
          // Fallback: equal weights if all λ are 0
          const dimensionScores = dimensionResults.map(d => d.affinityPercent)
          affinityPercent = round1(
            dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length
          )
        }
      } else {
        // Equal weights (default — skipped calibration)
        const dimensionScores = dimensionResults.map(d => d.affinityPercent)
        affinityPercent = round1(
          dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length
        )
      }
    }

    return {
      entityId,
      affinityPercent,
      evaluableQuestions: totalEvaluable,
      answeredQuestions: answered.length,
      coveragePercent: answered.length > 0
        ? round1((totalEvaluable / answered.length) * 100)
        : 0,
      dimensions: dimensionResults.sort((a, b) => a.dimensionName.localeCompare(b.dimensionName)),
      evidenceRefs: allEvidenceRefs,
      historical: entities.find(e => e.entityId === entityId)?.historical ?? false,
      dimensionsWithCoverage: evaluableDimIds.size,
      totalDimensions
    }
  })
}
