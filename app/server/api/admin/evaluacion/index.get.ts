import { listCampaigns } from '~/server/utils/evaluation'
import { withEvaluator } from '~/server/utils/evaluation-http'

/** Campañas asignadas al evaluador autenticado, con su progreso. */
export default defineEventHandler((event) => withEvaluator(event, async ({ pool, evaluator }) => ({
  evaluator: { label: evaluator.label, affiliation: evaluator.affiliation },
  campaigns: await listCampaigns(pool, evaluator)
})))
