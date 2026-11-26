import { listQueue } from '~/server/utils/adjudication'
import { withEvaluator } from '~/server/utils/evaluation-http'

/** Cola de adjudicación (en sombra). Zona NO ciega: solo accesible al administrador autenticado. */
export default defineEventHandler((event) => withEvaluator(event, ({ pool, evaluator }) => listQueue(pool, evaluator)))
