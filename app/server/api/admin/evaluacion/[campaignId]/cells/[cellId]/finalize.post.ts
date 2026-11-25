import { finalizeEvaluation } from '~/server/utils/evaluation'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/** Finalización irreversible: añade la evaluación a `position_codings` y bloquea el borrador. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return withEvaluator(event, ({ pool, evaluator }) => finalizeEvaluation(
    pool, evaluator, uuidParam(event, 'campaignId'), uuidParam(event, 'cellId'), Number(body?.expectedVersion), Number(body?.cellVersion)))
})
