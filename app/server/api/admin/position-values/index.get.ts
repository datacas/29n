import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'

const NO_CONDITIONS = /^(ning[uú]n[ao]?\b.*|no (se )?(hay|mencion|especific|indic|exist)\w*\b.*|sin (condicion|analizar)\w*.*|—|-|n\/a)$/i

/**
 * Asignación editorial de la postura (-2..+2) de las posiciones aprobadas.
 * Ciega: NO se envían las etiquetas de postura de Claude ni la sugerencia de Jev
 * (esta última solo con GET .../suggestions, cuando la persona la pide).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { rows } = await query(`
    SELECT p.id, q.pilot_question_id AS qid, q.canonical_text, e.name AS party, p.evidence_jsonb,
           p.value, p.stance_status, p.conditions,
           (SELECT a.created_at FROM editorial_audit a
             WHERE a.entity_id = p.id AND a.action = 'set_value' ORDER BY a.created_at DESC LIMIT 1) AS decided_at
      FROM positions p
      JOIN questions q ON q.id = p.question_id
      JOIN entities e ON e.id = p.entity_id
     WHERE q.pilot_question_id IS NOT NULL AND p.review_status = 'approved'
       AND p.evidence_jsonb IS NOT NULL AND jsonb_array_length(p.evidence_jsonb) > 0
     ORDER BY q.pilot_question_id, e.name
  `)
  const items = rows.map((r: any) => {
    const decided = !!r.decided_at
    return {
      positionId: r.id,
      questionId: r.qid,
      question: r.canonical_text,
      party: r.party,
      claims: (r.evidence_jsonb as any[]).map((c) => ({
        literalText: c.literal_text,
        translation: c.translation_es ?? null,
        page: c.source_page ?? null,
        conditions: c.conditions && !NO_CONDITIONS.test(String(c.conditions).trim()) ? c.conditions : null
      })),
      decided,
      // Solo se devuelve lo que decidió una persona; lo anterior venía del extractor
      value: decided ? r.value : null,
      stanceStatus: decided ? r.stance_status : null,
      conditions: decided ? r.conditions : null
    }
  })
  return { items, decided: items.filter((i: any) => i.decided).length, total: items.length }
})
