import { computeMetrics } from '~/server/utils/metrics'
import { withEvaluator } from '~/server/utils/evaluation-http'

/** Métricas de concordancia (IA–IA, humano–IA, humano–humano, repetibilidad), separadas y con la procedencia de las filas humanas. Solo administración local. */
export default defineEventHandler((event) => withEvaluator(event, ({ pool }) => {
  const q = getQuery(event)
  return computeMetrics(pool, { modality: String(q.modality ?? 'B'), set: String(q.set ?? 'S') })
}))
