// Calibration engine — pure TypeScript, runs 100% in browser
// Adaptive pairwise comparisons for serious calibration mode
// See scoring-methodology.md section 4.1 for the specification

// --- Types ---

export type ComparisonResult = 'left' | 'right' | 'equal' | 'skip'

export interface Comparison {
  leftDim: string
  rightDim: string
}

export interface CalibrationState {
  dimensions: string[]
  comparisons: Array<{
    left: string
    right: string
    result: ComparisonResult
  }>
  version: string
}

export interface CalibrationWeights {
  weights: Record<string, number>
  state: CalibrationState
}

// --- Constants ---

const CALIBRATION_VERSION = '1.0.0'

// --- Core Algorithm ---

/**
 * Compute weights from pairwise comparison results using a modified Borda count.
 * This is a deterministic, versioned algorithm that produces positive normalized weights.
 *
 * Method:
 * 1. For each comparison, assign points:
 *    - 'left' wins: left +2, right +0
 *    - 'right' wins: left +0, right +2
 *    - 'equal': both +1
 *    - 'skip': both +0.5 (baseline)
 * 2. Normalize so all weights sum to 1.
 * 3. Ensure all weights are positive (minimum 0.01 before normalization).
 */
export function computeWeightsFromComparisons(
  dimensions: string[],
  comparisons: Array<{ left: string; right: string; result: ComparisonResult }>
): Record<string, number> {
  if (dimensions.length === 0) return {}
  if (dimensions.length === 1) return { [dimensions[0]]: 1.0 }

  // Initialize scores
  const scores = new Map<string, number>()
  for (const dim of dimensions) {
    scores.set(dim, 0)
  }

  // Apply comparison results
  for (const comp of comparisons) {
    const { left, right, result } = comp
    switch (result) {
      case 'left':
        scores.set(left, (scores.get(left) ?? 0) + 2)
        break
      case 'right':
        scores.set(right, (scores.get(right) ?? 0) + 2)
        break
      case 'equal':
        scores.set(left, (scores.get(left) ?? 0) + 1)
        scores.set(right, (scores.get(right) ?? 0) + 1)
        break
      case 'skip':
        scores.set(left, (scores.get(left) ?? 0) + 0.5)
        scores.set(right, (scores.get(right) ?? 0) + 0.5)
        break
    }
  }

  // Ensure minimum weight
  const minWeight = 0.01
  const adjusted = new Map<string, number>()
  for (const dim of dimensions) {
    adjusted.set(dim, Math.max(scores.get(dim) ?? 0, minWeight))
  }

  // Normalize
  const total = Array.from(adjusted.values()).reduce((a, b) => a + b, 0)
  const weights: Record<string, number> = {}
  for (const dim of dimensions) {
    weights[dim] = Math.round((adjusted.get(dim)! / total) * 10000) / 10000
  }

  return weights
}

/**
 * Generate the next comparison using adaptive selection.
 * The algorithm chooses the pair with the most uncertainty (least compared).
 * This is deterministic: it uses dimension ID ordering as a tiebreaker.
 */
export function getNextComparison(
  dimensions: string[],
  comparisons: Array<{ left: string; right: string; result: ComparisonResult }>
): Comparison | null {
  if (dimensions.length < 2) return null

  // Count how many times each pair has been compared
  const compared = new Set<string>()
  for (const comp of comparisons) {
    const key = comp.left < comp.right ? `${comp.left}:${comp.right}` : `${comp.right}:${comp.left}`
    compared.add(key)
  }

  // Find all un-compared pairs, sorted by comparison count (least compared first)
  const pairs: Array<{ left: string; right: string; count: number }> = []
  for (let i = 0; i < dimensions.length; i++) {
    for (let j = i + 1; j < dimensions.length; j++) {
      const left = dimensions[i]
      const right = dimensions[j]
      const key = left < right ? `${left}:${right}` : `${right}:${left}`
      const count = compared.has(key) ? 1 : 0
      pairs.push({ left: left < right ? left : right, right: left < right ? right : left, count })
    }
  }

  // Sort by count (ascending), then by dimension IDs for determinism
  pairs.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count
    if (a.left !== b.left) return a.left.localeCompare(b.left)
    return a.right.localeCompare(b.right)
  })

  // Return the first un-compared pair, or null if all are compared
  const unCompared = pairs.filter(p => p.count === 0)
  if (unCompared.length > 0) {
    return { left: unCompared[0].left, right: unCompared[0].right }
  }

  return null
}

/**
 * Check if all pairwise comparisons have been made.
 */
export function allComparisonsDone(
  dimensions: string[],
  comparisons: Array<{ left: string; right: string; result: ComparisonResult }>
): boolean {
  const totalPairs = dimensions.length * (dimensions.length - 1) / 2
  const compared = new Set<string>()
  for (const comp of comparisons) {
    const key = comp.left < comp.right ? `${comp.left}:${comp.right}` : `${comp.right}:${comp.left}`
    compared.add(key)
  }
  return compared.size >= totalPairs
}

/**
 * Run the full calibration process interactively.
 * Returns the next comparison or final weights when done.
 */
export function calibrate(
  dimensions: string[],
  comparisons: Array<{ left: string; right: string; result: ComparisonResult }>
): {
  weights: Record<string, number>
  nextComparison: Comparison | null
  isComplete: boolean
} {
  const isComplete = allComparisonsDone(dimensions, comparisons)
  const weights = computeWeightsFromComparisons(dimensions, comparisons)
  const nextComparison = isComplete ? null : getNextComparison(dimensions, comparisons)

  return { weights, nextComparison, isComplete }
}

/**
 * Create a calibration state from quick mode (low/medium/high).
 */
export function quickCalibration(
  dimensions: string[],
  importances: Record<string, 'low' | 'medium' | 'high'>
): Record<string, number> {
  const WEIGHT_MAP: Record<string, number> = { low: 0.5, medium: 1.0, high: 2.0 }

  const raw = dimensions.map(dim => ({
    dim,
    weight: WEIGHT_MAP[importances[dim]] ?? WEIGHT_MAP['medium']
  }))

  const total = raw.reduce((sum, r) => sum + r.weight, 0)
  const weights: Record<string, number> = {}
  for (const r of raw) {
    weights[r.dim] = Math.round((r.weight / total) * 10000) / 10000
  }
  return weights
}

/**
 * Create default equal weights (skipped calibration).
 */
export function defaultCalibration(dimensions: string[]): Record<string, number> {
  const weight = dimensions.length > 0 ? 1 / dimensions.length : 0
  const weights: Record<string, number> = {}
  for (const dim of dimensions) {
    weights[dim] = Math.round(weight * 10000) / 10000
  }
  return weights
}

/**
 * Export calibration state for reproducibility.
 */
export function exportCalibrationState(
  dimensions: string[],
  comparisons: Array<{ left: string; right: string; result: ComparisonResult }>
): CalibrationState {
  return {
    dimensions,
    comparisons,
    version: CALIBRATION_VERSION
  }
}

/**
 * Reproduce weights from exported calibration state.
 */
export function reproduceFromState(state: CalibrationState): Record<string, number> {
  return computeWeightsFromComparisons(state.dimensions, state.comparisons)
}
