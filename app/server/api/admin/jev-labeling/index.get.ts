import { requireAdmin } from '~/server/utils/auth'
import { isLabeled, readSample } from '~/server/utils/labeling'

/**
 * Etiquetado humano ciego: se devuelve solo lo que necesita la persona
 * (pregunta, citas, página, condiciones). NO se envían la propuesta de Claude,
 * el estrato ni el resultado de Jev, para no condicionar la referencia.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sample = readSample()
  const items = sample.items.map((i: any) => ({
    positionId: i.position_id,
    questionId: i.question_id,
    party: i.party,
    question: i.question,
    claims: i.claims.map((c: any) => ({
      literalText: c.literal_text,
      page: c.page ?? null,
      conditions: c.conditions ?? null
    })),
    human: {
      stance: i.human?.stance ?? null,
      evidenceSufficient: i.human?.evidence_sufficient ?? null,
      annotator: i.human?.annotator ?? null,
      notes: i.human?.notes ?? ''
    }
  }))
  return { items, labeled: sample.items.filter(isLabeled).length, total: items.length }
})
