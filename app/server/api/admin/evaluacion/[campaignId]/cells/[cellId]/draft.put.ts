import { saveDraft } from '~/server/utils/evaluation'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/** Guardado automático del borrador con concurrencia optimista (`expectedVersion`). */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return withEvaluator(event, ({ pool, evaluator }) => saveDraft(
    pool, evaluator, uuidParam(event, 'campaignId'), uuidParam(event, 'cellId'), Number(body?.expectedVersion ?? 0),
    {
      documentClass: body?.documentClass ?? null, intensity: body?.intensity ?? null, selectedEvidence: body?.selectedEvidence ?? [],
      rationale: body?.rationale ?? '', insufficientContext: !!body?.insufficientContext, cellVersion: Number(body?.cellVersion)
    }))
})
