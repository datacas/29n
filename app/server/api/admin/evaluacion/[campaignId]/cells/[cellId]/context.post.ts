import { requestContext, resolveContextRequest } from '~/server/utils/evaluation'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/**
 * Contexto adicional sin obligar a puntuar. `action: 'request'` registra la petición; `action: 'expand'` la atiende creando una VERSIÓN NUEVA de la celda
 * (páginas contiguas a las mostradas). La versión original no se modifica.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return withEvaluator(event, async ({ pool, evaluator }) => {
    const campaignId = uuidParam(event, 'campaignId'); const cellId = uuidParam(event, 'cellId')
    if (body?.action === 'expand') return resolveContextRequest(pool, evaluator, campaignId, cellId)
    return requestContext(pool, evaluator, campaignId, cellId, String(body?.note ?? ''))
  })
})
