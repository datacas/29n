/**
 * Adjudicación en SOMBRA del piloto (D23). Solo-añadir; NO modifica positions ni el banco; NO resuelve por mayoría.
 * Esta zona NO es ciega (muestra la referencia y las respuestas de IA): el servidor exige haber FINALIZADO antes la evaluación propia de la celda
 * (y la propia BD lo vuelve a exigir con un disparador).
 */
import { EvalError, DOCUMENT_CLASSES, getProvenance, type DocumentClass, type Queryable } from './evaluation'

export const CAUSES = [
  'retrieval_error', 'interpretation_error', 'intensity_error', 'insufficient_evidence', 'contradictory_evidence', 'ambiguous_question',
  'manual_insufficient', 'omitted_position', 'unsupported_registered_position', 'reasonable_disagreement', 'other'
] as const
export type Cause = typeof CAUSES[number]
export const ACTIONS = ['confirm_registered', 'correct_registered', 'remove_registered', 'add_position', 'no_change'] as const
const INTENSITY: Record<DocumentClass, number[]> = { supports: [1, 2], opposes: [-2, -1], explicit_neutral: [0], not_mentioned: [], ambiguous: [] }

type Evaluator = { id: string; label: string; affiliation: 'internal' | 'external' }

async function requireOwnFinalized(db: Queryable, evaluator: Evaluator, cellId: string) {
  const { rows } = await db.query(
    `SELECT d.coding_id, d.cell_version, k.manual_version FROM eval_drafts d JOIN eval_cells c ON c.id = d.cell_id JOIN eval_campaigns k ON k.id = c.campaign_id
      WHERE d.cell_id = $1 AND d.evaluator_id = $2 AND d.finalized_at IS NOT NULL`, [cellId, evaluator.id])
  if (!rows[0]) throw new EvalError(403, 'Finaliza primero tu propia evaluación de esta celda')
  return rows[0] as { coding_id: string; cell_version: number; manual_version: string }
}

async function history(db: Queryable, cellId: string, evaluatorId: string) {
  const { rows } = await db.query(
    `SELECT x.id, x.revision, x.document_class AS "documentClass", x.intensity, x.causes, x.other_cause_text AS "otherCauseText", x.proposed_action AS "proposedAction", x.rationale, x.evidence, x.created_at AS "createdAt",
            x.manual_version AS "manualVersion", x.cell_version AS "cellVersion", x.applied,
            (SELECT row_to_json(a) FROM (SELECT s.author_kind AS "authorKind", s.author_label AS "authorLabel", s.authorized_by AS "authorizedBy", s.note FROM eval_authorship s
               WHERE s.record_table = 'eval_adjudications' AND s.record_id = x.id ORDER BY s.recorded_at DESC LIMIT 1) a) AS authorship
       FROM eval_adjudications x WHERE x.cell_id = $1 AND x.adjudicator_id = $2 ORDER BY x.revision DESC`, [cellId, evaluatorId])
  return rows
}

export async function listQueue(db: Queryable, evaluator: Evaluator) {
  const { rows } = await db.query(
    `SELECT i.cell_id AS "cellId", i.priority, i.reasons, c.ord, c.blind_label AS "blindLabel",
            (SELECT count(*) FROM eval_drafts d WHERE d.cell_id = i.cell_id AND d.evaluator_id = $1 AND d.finalized_at IS NOT NULL)::int AS "ownFinalized",
            a.revision, a.document_class AS "documentClass", a.intensity, a.causes, a.proposed_action AS "proposedAction"
       FROM eval_adjudication_items i JOIN eval_cells c ON c.id = i.cell_id
       JOIN eval_assignments s ON s.cell_id = i.cell_id AND s.evaluator_id = $1
       LEFT JOIN LATERAL (SELECT * FROM eval_adjudications x WHERE x.cell_id = i.cell_id AND x.adjudicator_id = $1 ORDER BY revision DESC LIMIT 1) a ON true
      ORDER BY i.priority`, [evaluator.id])
  const counts: Record<string, number> = {}
  for (const r of rows) for (const c of r.causes ?? []) counts[c] = (counts[c] ?? 0) + 1
  const { rows: [camp] } = await db.query(`SELECT c.campaign_id AS id FROM eval_adjudication_items i JOIN eval_cells c ON c.id = i.cell_id LIMIT 1`)
  const provenance = camp ? (await getProvenance(db, evaluator.id, camp.id)).adjudication : { provenance: 'unverified', statement: 'Sin declaración de procedencia.' }
  return { items: rows.map((r: any) => ({ ...r, status: r.revision ? 'adjudicada' : 'pendiente' })), causeCounts: counts, provenance }
}

export async function getAdjudication(db: Queryable, evaluator: Evaluator, cellId: string) {
  await requireOwnFinalized(db, evaluator, cellId)
  const { rows: [it] } = await db.query(
    `SELECT i.priority, i.reasons, i.dossier, c.ord, k.manual_text AS "manualText", k.manual_version AS "manualVersion"
       FROM eval_adjudication_items i JOIN eval_cells c ON c.id = i.cell_id JOIN eval_campaigns k ON k.id = c.campaign_id
       JOIN eval_assignments s ON s.cell_id = i.cell_id AND s.evaluator_id = $2 WHERE i.cell_id = $1`, [cellId, evaluator.id])
  if (!it) throw new EvalError(404, 'Celda no encontrada en la cola de adjudicación')
  return { cellId, ...it, history: await history(db, cellId, evaluator.id) }
}

export interface AdjudicationInput {
  documentClass?: DocumentClass | null; intensity?: number | null; causes: string[]; otherCauseText?: string | null
  proposedAction?: string | null; rationale: string; evidence?: { page?: number | null; text: string; source?: string }[]; expectedRevision: number
}

export async function saveAdjudication(db: Queryable, evaluator: Evaluator, cellId: string, input: AdjudicationInput) {
  const own = await requireOwnFinalized(db, evaluator, cellId)
  const { rows: [it] } = await db.query('SELECT 1 FROM eval_adjudication_items WHERE cell_id = $1', [cellId])
  if (!it) throw new EvalError(404, 'Celda no encontrada en la cola de adjudicación')
  const cls = input.documentClass ?? null
  if (cls && !DOCUMENT_CLASSES.includes(cls)) throw new EvalError(400, 'Clase documental no válida')
  if (cls && !INTENSITY[cls].includes(input.intensity as number) && !(INTENSITY[cls].length === 0 && input.intensity == null)) throw new EvalError(400, 'La intensidad no es coherente con la clase')
  if (!cls && input.intensity != null) throw new EvalError(400, 'No puede haber intensidad sin clase')
  const causes = [...new Set(input.causes ?? [])]
  if (!causes.length || causes.some((c) => !(CAUSES as readonly string[]).includes(c))) throw new EvalError(400, 'Indica al menos una causa válida')
  if (causes.includes('other') && !String(input.otherCauseText ?? '').trim()) throw new EvalError(400, 'Describe la «otra causa»')
  if (input.proposedAction && !(ACTIONS as readonly string[]).includes(input.proposedAction)) throw new EvalError(400, 'Acción propuesta no válida')
  if (!String(input.rationale ?? '').trim() || input.rationale.length > 6000) throw new EvalError(400, 'Escribe la justificación')
  const ev = (input.evidence ?? []).slice(0, 20).map((e) => ({ page: Number.isInteger(e.page) ? e.page : null, text: String(e.text ?? '').slice(0, 3000), source: String(e.source ?? '').slice(0, 100) })).filter((e) => e.text.trim())
  const { rows: [last] } = await db.query('SELECT max(revision)::int AS r FROM eval_adjudications WHERE cell_id = $1 AND adjudicator_id = $2', [cellId, evaluator.id])
  const current = last?.r ?? 0
  if (input.expectedRevision !== current) throw new EvalError(409, 'La adjudicación cambió (otra pestaña o doble envío); recarga', { currentRevision: current })
  try {
    const { rows: [r] } = await db.query(
      `INSERT INTO eval_adjudications (cell_id, adjudicator_id, document_class, intensity, rationale, causes, other_cause_text, proposed_action, evidence, own_coding_id, manual_version, cell_version, revision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, revision, created_at`,
      [cellId, evaluator.id, cls, input.intensity ?? null, input.rationale.trim(), causes, causes.includes('other') ? String(input.otherCauseText).trim() : null,
        input.proposedAction ?? null, JSON.stringify(ev), own.coding_id, own.manual_version, own.cell_version, current + 1])
    await db.query('INSERT INTO eval_audit (evaluator_id, action, cell_id, detail) VALUES ($1,$2,$3,$4)', [evaluator.id, 'adjudicated', cellId, JSON.stringify({ revision: r.revision, class: cls, causes })])
    // Autoría material: desde la interfaz no se puede saber quién la maneja; la procedencia se declara aparte (eval_provenance) y puede anotarse después en eval_authorship.
    await db.query(`INSERT INTO eval_authorship (record_table, record_id, author_kind, author_label, note) VALUES ('eval_adjudications', $1, 'unverified', $2, 'registrada desde la interfaz; procedencia declarada aparte (eval_provenance)')`, [r.id, evaluator.label])
    return { id: r.id as string, revision: r.revision as number }
  } catch (e: any) {
    if (e?.code === '23505') throw new EvalError(409, 'La adjudicación cambió; recarga', { currentRevision: current })
    throw e
  }
}
