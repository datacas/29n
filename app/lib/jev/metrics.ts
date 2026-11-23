import { STANCE_CLASSES, type StanceClass } from './types.ts'

/** Una predicción es null cuando el modelo se abstiene. */
export interface Scored {
  gold: StanceClass
  predicted: StanceClass | null
  latencyMs?: number
  inputTokens?: number
  costUsd?: number
}

export interface ClassMetrics {
  precision: number | null
  recall: number | null
  f1: number | null
  support: number
}

export interface BenchmarkMetrics {
  n: number
  answered: number
  abstentionRate: number
  /** Aciertos sobre las respuestas no abstenidas */
  accuracyAnswered: number | null
  /** Aciertos contando abstención como fallo */
  accuracyOverall: number | null
  macroF1: number | null
  perClass: Record<StanceClass, ClassMetrics>
  /** confusion[gold][predicted | 'abstain'] */
  confusion: Record<string, Record<string, number>>
  /** predijo 'supports' cuando la referencia humana no era 'supports' */
  falseSupport: number
  /** predijo 'opposes' cuando la referencia humana no era 'opposes' */
  falseOppose: number
  /** Inversión de polaridad: supports<->opposes */
  polarityFlips: number
  /** De las posiciones que la persona marcó unclear/contradictory, cuántas detectó (clase correcta o abstención) */
  uncertainDetectionRate: number | null
  latencyMs: { p50: number | null; p95: number | null }
  inputTokens: number
  costUsd: number
}

function ratio(a: number, b: number): number | null {
  return b === 0 ? null : a / b
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)
  return s[Math.max(0, idx)]
}

export function computeMetrics(rows: Scored[]): BenchmarkMetrics {
  const n = rows.length
  const answeredRows = rows.filter((r) => r.predicted !== null)
  const correct = answeredRows.filter((r) => r.predicted === r.gold).length

  const confusion: Record<string, Record<string, number>> = {}
  for (const g of STANCE_CLASSES) {
    confusion[g] = {}
    for (const p of [...STANCE_CLASSES, 'abstain']) confusion[g][p] = 0
  }
  for (const r of rows) confusion[r.gold][r.predicted ?? 'abstain']++

  const perClass = {} as Record<StanceClass, ClassMetrics>
  const f1s: number[] = []
  for (const c of STANCE_CLASSES) {
    const tp = confusion[c][c]
    const predicted = rows.filter((r) => r.predicted === c).length
    const support = rows.filter((r) => r.gold === c).length
    const precision = ratio(tp, predicted)
    const recall = ratio(tp, support)
    const f1 =
      precision !== null && recall !== null && precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : precision === null && recall === null
          ? null
          : 0
    perClass[c] = { precision, recall, f1, support }
    if (support > 0 && f1 !== null) f1s.push(f1)
  }

  const uncertain = rows.filter((r) => r.gold === 'unclear' || r.gold === 'contradictory')
  const uncertainDetected = uncertain.filter(
    (r) => r.predicted === null || r.predicted === r.gold || r.predicted === 'unclear' || r.predicted === 'contradictory'
  ).length

  const latencies = rows.map((r) => r.latencyMs).filter((x): x is number => typeof x === 'number')

  return {
    n,
    answered: answeredRows.length,
    abstentionRate: n === 0 ? 0 : (n - answeredRows.length) / n,
    accuracyAnswered: ratio(correct, answeredRows.length),
    accuracyOverall: ratio(correct, n),
    macroF1: f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : null,
    perClass,
    confusion,
    falseSupport: rows.filter((r) => r.predicted === 'supports' && r.gold !== 'supports').length,
    falseOppose: rows.filter((r) => r.predicted === 'opposes' && r.gold !== 'opposes').length,
    polarityFlips: rows.filter(
      (r) =>
        (r.predicted === 'supports' && r.gold === 'opposes') || (r.predicted === 'opposes' && r.gold === 'supports')
    ).length,
    uncertainDetectionRate: ratio(uncertainDetected, uncertain.length),
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    inputTokens: rows.reduce((a, r) => a + (r.inputTokens ?? 0), 0),
    costUsd: rows.reduce((a, r) => a + (r.costUsd ?? 0), 0)
  }
}

/** Acuerdo entre dos clasificadores (p. ej. Jev vs Claude), ignorando abstenciones. */
export function agreement(pairs: Array<[StanceClass | null, StanceClass | null]>) {
  const both = pairs.filter(([a, b]) => a !== null && b !== null)
  const same = both.filter(([a, b]) => a === b).length
  return { comparable: both.length, agree: same, rate: ratio(same, both.length) }
}
