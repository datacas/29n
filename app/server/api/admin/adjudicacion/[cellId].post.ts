import { saveAdjudication } from '~/server/utils/adjudication'
import { uuidParam, withEvaluator } from '~/server/utils/evaluation-http'

/** Registra una adjudicación NUEVA (solo añadir, en sombra: no modifica positions ni el banco). */
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  return withEvaluator(event, ({ pool, evaluator }) => saveAdjudication(pool, evaluator, uuidParam(event, 'cellId'), {
    documentClass: b?.documentClass ?? null, intensity: b?.intensity ?? null, causes: Array.isArray(b?.causes) ? b.causes : [], otherCauseText: b?.otherCauseText ?? null,
    proposedAction: b?.proposedAction ?? null, rationale: String(b?.rationale ?? ''), evidence: Array.isArray(b?.evidence) ? b.evidence : [], expectedRevision: Number(b?.expectedRevision ?? 0)
  }))
})
