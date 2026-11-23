import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'

/**
 * SPIKE-12: priorización de la revisión humana según Jev vs Claude.
 * Solo lectura sobre jev_shadow_reviews; nunca toca positions.review_status.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { rows } = await query(`
    SELECT DISTINCT ON (r.position_id)
           r.position_id, r.run_id, r.mode, r.model, r.created_at,
           r.claude_class, r.jev_class, r.triage_group, r.triage_reasons, r.quote_statuses,
           r.verdict, r.latency_ms, r.cost_usd,
           e.name AS party, q.pilot_question_id AS question_id, q.canonical_text AS question,
           p.review_status
      FROM jev_shadow_reviews r
      JOIN positions p ON p.id = r.position_id
      JOIN entities e ON e.id = p.entity_id
      JOIN questions q ON q.id = p.question_id
     WHERE r.run_kind = 'shadow'
     ORDER BY r.position_id, r.created_at DESC
  `)

  const order: Record<string, number> = { contradictory: 0, doubtful: 1, high_confidence: 2 }
  const items = rows
    .map((r: any) => ({
      positionId: r.position_id,
      party: r.party,
      questionId: r.question_id,
      question: r.question,
      reviewStatus: r.review_status,
      claudeClass: r.claude_class,
      jevClass: r.jev_class,
      group: r.triage_group,
      reasons: r.triage_reasons ?? [],
      quoteStatuses: r.quote_statuses ?? [],
      evidenceSufficientP: r.verdict?.evidenceSufficientP ?? null,
      relevance: r.verdict?.relevance ?? null,
      model: r.model,
      mode: r.mode,
      runId: r.run_id,
      createdAt: r.created_at
    }))
    // Dentro de cada grupo, primero lo que Jev ve menos suficiente (más probable de rechazar)
    .sort(
      (a: any, b: any) =>
        order[a.group] - order[b.group] ||
        (a.evidenceSufficientP ?? 0) - (b.evidenceSufficientP ?? 0) ||
        a.questionId.localeCompare(b.questionId) ||
        a.party.localeCompare(b.party)
    )

  const counts = { contradictory: 0, doubtful: 0, high_confidence: 0 } as Record<string, number>
  for (const i of items) counts[i.group]++

  return { items, counts, total: items.length }
})
