import { listCells } from '~/server/utils/evaluation'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/** Lista de celdas (orden, etiqueta ciega y estado). No incluye contenido ni partido. */
export default defineEventHandler((event) => withEvaluator(event, async ({ pool, evaluator }) => ({
  cells: await listCells(pool, evaluator, uuidParam(event, 'campaignId'))
})))
