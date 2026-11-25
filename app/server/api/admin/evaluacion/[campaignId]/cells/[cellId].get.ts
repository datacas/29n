import { getCell } from '~/server/utils/evaluation'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/** Celda ciega (lista blanca de campos) y borrador propio. */
export default defineEventHandler((event) => withEvaluator(event, ({ pool, evaluator }) =>
  getCell(pool, evaluator, uuidParam(event, 'campaignId'), uuidParam(event, 'cellId'))))
