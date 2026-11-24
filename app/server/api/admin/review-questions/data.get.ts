import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'

import { QUESTION_DIMENSION_MAP } from '~/server/utils/dimensions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  // Load questions and positions from PostgreSQL
  const { rows: partyRows } = await query(`SELECT DISTINCT e.name FROM entities e JOIN positions p ON p.entity_id = e.id JOIN questions q ON q.id = p.question_id WHERE e.type = 'party' AND q.pilot_question_id IS NOT NULL ORDER BY e.name`)
  const parties: string[] = partyRows.map((r: any) => r.name)

  // Get all pilot questions
  const questionsResult = await query(
    `SELECT q.pilot_question_id, q.canonical_text, q.id as db_id, d.name AS dimension_name
     FROM questions q
     LEFT JOIN topics t ON t.id = q.topic_id
     LEFT JOIN dimensions d ON d.id = t.dimension_id
     WHERE q.pilot_question_id IS NOT NULL
     ORDER BY q.pilot_question_id`
  )

  // Get all entities
  const entitiesResult = await query(
    `SELECT id, name FROM entities WHERE name = ANY($1)`,
    [parties]
  )
  const entityMap: Record<string, string> = {}
  for (const row of entitiesResult.rows) {
    entityMap[row.name] = row.id
  }

  // Get all positions for pilot questions
  const positionsResult = await query(
    `SELECT q.pilot_question_id, e.name as party, p.evidence_jsonb, p.review_status, p.stance_status,
            p.reviewed_by, p.reviewed_at, p.review_note
     FROM positions p
     JOIN questions q ON p.question_id = q.id
     JOIN entities e ON p.entity_id = e.id
     WHERE q.pilot_question_id IS NOT NULL
       AND e.name = ANY($1)
     ORDER BY q.pilot_question_id, e.name`,
    [parties]
  )

  // Build position map: question_id × party → position
  const positionMap: Record<string, any> = {}
  for (const row of positionsResult.rows) {
    const key = `${row.pilot_question_id}-${row.party}`
    positionMap[key] = {
      party: row.party,
      evidence_jsonb: row.evidence_jsonb || [],
      review_status: row.review_status,
      stance_status: row.stance_status,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      review_note: row.review_note,
    }
  }

  // Build questions array with review_status from positions
  const questions = questionsResult.rows.map((q: any) => {
    const evidenceByParty: Record<string, any[]> = {}
    const reviewByParty: Record<string, any> = {}
    const partiesWithEvidence: string[] = []
    const partiesWithoutEvidence: string[] = []

    for (const party of parties) {
      const pos = positionMap[`${q.pilot_question_id}-${party}`]
      if (pos) {
        reviewByParty[party] = {
          review_status: pos.review_status,
          review_note: pos.review_note || null,
        }
      }
      if (pos && pos.evidence_jsonb && pos.evidence_jsonb.length > 0) {
        // Tag each evidence item with the position's review_status
        const evidence = pos.evidence_jsonb.map((e: any) => ({
          ...e,
          review_status: pos.review_status,
        }))
        evidenceByParty[party] = evidence
        partiesWithEvidence.push(party)
      } else {
        partiesWithoutEvidence.push(party)
      }
    }

    return {
      question_id: q.pilot_question_id,
      question: q.canonical_text,
      dimension: q.dimension_name || QUESTION_DIMENSION_MAP[q.pilot_question_id] || 'Sin dimensión',
      evidence_by_party: evidenceByParty,
      review_by_party: reviewByParty,
      parties_with_evidence: partiesWithEvidence,
      parties_without_evidence: partiesWithoutEvidence,
      evidence_count: Object.values(evidenceByParty).reduce((sum: number, arr: any[]) => sum + arr.length, 0),
    }
  })

  return { questions, parties }
})
