import { getAdjudication } from '~/server/utils/adjudication'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/** Expediente de una celda: requiere haber finalizado antes tu propia evaluación (403 en otro caso). */
export default defineEventHandler((event) => withEvaluator(event, ({ pool, evaluator }) => getAdjudication(pool, evaluator, uuidParam(event, 'cellId'))))
