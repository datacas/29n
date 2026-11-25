/**
 * Evaluación humana ciega (panel administrativo LOCAL; D21).
 *
 * Principios:
 *  - CEGUERA desde el servidor: las consultas de evaluación solo leen `eval_cell_versions.snapshot` (sin partido, referencia ni respuestas de IA),
 *    `eval_cells` (sin `party_name`) y los borradores del propio evaluador. Nunca `positions`, ni `position_codings` de otros evaluadores.
 *  - Los borradores se guardan con concurrencia optimista (`version`); al finalizar, una transacción añade la fila a `position_codings`
 *    (solo añadir) y bloquea el borrador. No hay edición posterior.
 *  - La insuficiencia de contexto es una conclusión del evaluador (`insufficient_context`), no un estado técnico (`execution_status` = ok).
 *  - Toda función recibe la conexión (`Queryable`/`Pool`) para poder probarse contra una BD temporal.
 */
import { createHash } from 'node:crypto'

export interface Queryable { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> }
export interface TxPool extends Queryable { connect: () => Promise<Queryable & { release: () => void }> }

export class EvalError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message) }
}

export const DOCUMENT_CLASSES = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous'] as const
export type DocumentClass = typeof DOCUMENT_CLASSES[number]
export const INTERNAL_LABEL = 'Humano interno 1'
const MAX_RATIONALE = 4000

const INTENSITY_BY_CLASS: Record<DocumentClass, number[]> = {
  supports: [1, 2], opposes: [-2, -1], explicit_neutral: [0], not_mentioned: [], ambiguous: []
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

export interface EvalPassage { page: number | null; text: string }
export interface EvalSnapshot { item: string; context: string; language?: string; passages: EvalPassage[] }

async function audit(db: Queryable, evaluatorId: string | null, action: string, campaignId: string | null, cellId: string | null, detail: Record<string, unknown> = {}) {
  await db.query('INSERT INTO eval_audit (evaluator_id, action, campaign_id, cell_id, detail) VALUES ($1,$2,$3,$4,$5)', [evaluatorId, action, campaignId, cellId, JSON.stringify(detail)])
}

/** Identidad del evaluador a partir de la credencial administrativa autenticada. Hoy: administrador autenticado = evaluador interno. */
export async function resolveEvaluator(db: Queryable, credentialId: string) {
  const found = await db.query('SELECT id, label, affiliation, active FROM eval_evaluators WHERE credential_id = $1', [credentialId])
  let ev = found.rows[0]
  if (!ev) {
    const ins = await db.query(
      `INSERT INTO eval_evaluators (label, affiliation, credential_id) VALUES ($1, 'internal', $2)
       ON CONFLICT (label) DO UPDATE SET credential_id = COALESCE(eval_evaluators.credential_id, EXCLUDED.credential_id)
       RETURNING id, label, affiliation, active, credential_id`, [INTERNAL_LABEL, credentialId])
    ev = ins.rows[0]
    if (ev.credential_id && ev.credential_id !== credentialId) throw new EvalError(403, 'El evaluador interno está vinculado a otra credencial')
  }
  if (!ev.active) throw new EvalError(403, 'Evaluador desactivado')
  return { id: ev.id as string, label: ev.label as string, affiliation: ev.affiliation as 'internal' | 'external' }
}

type Evaluator = { id: string; label: string; affiliation: 'internal' | 'external' }

async function requireAssignment(db: Queryable, evaluatorId: string, campaignId: string, cellId: string) {
  const { rows } = await db.query(
    `SELECT c.id AS cell_id, c.ord, c.blind_label, c.question_id, c.entity_id, k.id AS campaign_id, k.status, k.manual_version, k.manual_text
       FROM eval_cells c JOIN eval_campaigns k ON k.id = c.campaign_id
       JOIN eval_assignments a ON a.cell_id = c.id AND a.evaluator_id = $1
      WHERE c.id = $2 AND k.id = $3`, [evaluatorId, cellId, campaignId])
  if (!rows[0]) throw new EvalError(404, 'Celda no encontrada')   // misma respuesta si no existe o no está asignada
  return rows[0]
}

async function latestVersion(db: Queryable, cellId: string) {
  const { rows } = await db.query('SELECT version, snapshot, sha256 FROM eval_cell_versions WHERE cell_id = $1 ORDER BY version DESC LIMIT 1', [cellId])
  if (!rows[0]) throw new EvalError(500, 'La celda no tiene instantánea')
  return rows[0] as { version: number; snapshot: EvalSnapshot; sha256: string }
}

function status(d: any): 'pending' | 'draft' | 'finalized' {
  if (!d) return 'pending'
  if (d.finalized_at) return 'finalized'
  return d.document_class || d.insufficient_context || d.rationale || (d.selected_evidence?.length ?? 0) ? 'draft' : 'pending'
}

/** Procedencia vigente (última fila) por ámbito para un evaluador y campaña. Sin registro = 'unverified' (no se cita como humana). */
export async function getProvenance(db: Queryable, evaluatorId: string, campaignId: string) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (scope) scope, provenance, statement, recorded_at AS "recordedAt" FROM eval_provenance WHERE evaluator_id = $1 AND campaign_id = $2 ORDER BY scope, recorded_at DESC`, [evaluatorId, campaignId])
  const by: Record<string, any> = Object.fromEntries(rows.map((r: any) => [r.scope, r]))
  const pick = (scope: 'evaluation' | 'adjudication') => by[scope] ?? by.all ?? { provenance: 'unverified', statement: 'Sin declaración de procedencia: no se cita como evaluación humana.' }
  return { evaluation: pick('evaluation'), adjudication: pick('adjudication') }
}

export async function listCampaigns(db: Queryable, evaluator: Evaluator) {
  const { rows } = await db.query(
    `SELECT k.id, k.name, k.kind, k.status, k.manual_version, k.selection_method, k.selection_bias_note, k.created_at,
            count(a.id)::int AS total,
            count(d.id) FILTER (WHERE d.finalized_at IS NOT NULL)::int AS finalized,
            count(d.id) FILTER (WHERE d.finalized_at IS NULL)::int AS drafts
       FROM eval_campaigns k
       JOIN eval_cells c ON c.campaign_id = k.id
       JOIN eval_assignments a ON a.cell_id = c.id AND a.evaluator_id = $1
       LEFT JOIN eval_drafts d ON d.cell_id = c.id AND d.evaluator_id = $1
      GROUP BY k.id ORDER BY k.created_at DESC`, [evaluator.id])
  return Promise.all(rows.map(async (r: any) => ({ ...r, provenance: (await getProvenance(db, evaluator.id, r.id)).evaluation })))
}

export async function listCells(db: Queryable, evaluator: Evaluator, campaignId: string) {
  const { rows } = await db.query(
    `SELECT c.id AS "cellId", c.ord, c.blind_label AS "blindLabel", k.status AS "campaignStatus",
            d.document_class, d.intensity, d.insufficient_context, d.rationale, d.selected_evidence, d.finalized_at,
            EXISTS (SELECT 1 FROM eval_context_requests r WHERE r.cell_id = c.id AND r.evaluator_id = $1 AND r.status = 'open') AS "contextRequestOpen"
       FROM eval_cells c JOIN eval_campaigns k ON k.id = c.campaign_id
       JOIN eval_assignments a ON a.cell_id = c.id AND a.evaluator_id = $1
       LEFT JOIN eval_drafts d ON d.cell_id = c.id AND d.evaluator_id = $1
      WHERE k.id = $2 ORDER BY c.ord`, [evaluator.id, campaignId])
  if (!rows.length) throw new EvalError(404, 'Campaña no encontrada')
  return rows.map((r: any) => ({ cellId: r.cellId, ord: r.ord, blindLabel: r.blindLabel, status: status(r), documentClass: r.document_class ?? null, intensity: r.intensity ?? null, hasRationale: !!String(r.rationale ?? '').trim(), evidenceCount: (r.selected_evidence ?? []).length, insufficientContext: !!r.insufficient_context && !r.finalized_at, contextRequestOpen: r.contextRequestOpen, campaignStatus: r.campaignStatus }))
}

/** Celda ciega: lista blanca de campos. No incluye partido, referencia, respuestas de IA ni otras evaluaciones. */
export async function getCell(db: Queryable, evaluator: Evaluator, campaignId: string, cellId: string) {
  const c = await requireAssignment(db, evaluator.id, campaignId, cellId)
  const v = await latestVersion(db, cellId)
  const { rows: [d] } = await db.query('SELECT * FROM eval_drafts WHERE cell_id = $1 AND evaluator_id = $2', [cellId, evaluator.id])
  const { rows: [req] } = await db.query(`SELECT id, note, status, requested_at, resolved_version FROM eval_context_requests WHERE cell_id = $1 AND evaluator_id = $2 ORDER BY requested_at DESC LIMIT 1`, [cellId, evaluator.id])
  return {
    cellId: c.cell_id as string, ord: c.ord as number, blindLabel: c.blind_label as string,
    campaignStatus: c.status as string, manualVersion: c.manual_version as string, manualText: c.manual_text as string,
    version: v.version,
    item: v.snapshot.item, context: v.snapshot.context,
    passages: v.snapshot.passages.map((p) => ({ page: p.page ?? null, text: p.text })),
    draft: d ? {
      version: d.version as number, cellVersion: d.cell_version as number,
      documentClass: d.document_class as string | null, intensity: d.intensity as number | null,
      selectedEvidence: d.selected_evidence as number[], rationale: d.rationale as string,
      insufficientContext: d.insufficient_context as boolean, updatedAt: d.updated_at, finalized: !!d.finalized_at
    } : null,
    contextRequest: req ? { note: req.note as string, status: req.status as string, requestedAt: req.requested_at, resolvedVersion: req.resolved_version as number | null } : null
  }
}

export interface DraftPatch {
  documentClass?: DocumentClass | null
  intensity?: number | null
  selectedEvidence?: number[]
  rationale?: string
  insufficientContext?: boolean
  cellVersion: number
}

function validatePatch(p: DraftPatch, passageCount: number) {
  if (p.documentClass != null && !DOCUMENT_CLASSES.includes(p.documentClass)) throw new EvalError(400, 'Clase documental no válida')
  if (p.intensity != null && (!Number.isInteger(p.intensity) || p.intensity < -2 || p.intensity > 2)) throw new EvalError(400, 'Intensidad no válida')
  if (p.documentClass && p.intensity != null && !INTENSITY_BY_CLASS[p.documentClass].includes(p.intensity)) throw new EvalError(400, 'La intensidad no es coherente con la clase')
  if (p.selectedEvidence && (!Array.isArray(p.selectedEvidence) || p.selectedEvidence.some((i) => !Number.isInteger(i) || i < 0 || i >= passageCount))) throw new EvalError(400, 'Evidencia seleccionada no válida')
  if (p.rationale != null && (typeof p.rationale !== 'string' || p.rationale.length > MAX_RATIONALE)) throw new EvalError(400, 'Justificación no válida')
}

/** Guardado automático. `expectedVersion` = versión del borrador que el cliente cree tener (0 si aún no existe). */
export async function saveDraft(db: Queryable, evaluator: Evaluator, campaignId: string, cellId: string, expectedVersion: number, patch: DraftPatch) {
  const c = await requireAssignment(db, evaluator.id, campaignId, cellId)
  if (c.status !== 'open') throw new EvalError(409, 'La campaña no está abierta')
  const v = await latestVersion(db, cellId)
  if (patch.cellVersion !== v.version) throw new EvalError(409, 'La celda tiene una versión más reciente; recárgala', { currentCellVersion: v.version })
  validatePatch(patch, v.snapshot.passages.length)
  const cls = patch.documentClass ?? null
  // Sin preselección: nada se rellena por defecto. La intensidad solo se guarda si el cliente la envía.
  const vals = [cls, patch.intensity ?? null, JSON.stringify(patch.selectedEvidence ?? []), patch.rationale ?? '', !!patch.insufficientContext]
  if (expectedVersion === 0) {
    const ins = await db.query(
      `INSERT INTO eval_drafts (cell_id, evaluator_id, cell_version, document_class, intensity, selected_evidence, rationale, insufficient_context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (cell_id, evaluator_id) DO NOTHING RETURNING version, updated_at`,
      [cellId, evaluator.id, v.version, ...vals])
    if (!ins.rows[0]) throw new EvalError(409, 'El borrador ya existe con otra versión (¿otra pestaña?)')
    return { version: ins.rows[0].version as number, updatedAt: ins.rows[0].updated_at }
  }
  const { rows: [cur] } = await db.query('SELECT version, finalized_at FROM eval_drafts WHERE cell_id = $1 AND evaluator_id = $2', [cellId, evaluator.id])
  if (cur?.finalized_at) throw new EvalError(409, 'La evaluación ya está finalizada y no se puede modificar')
  const upd = await db.query(
    `UPDATE eval_drafts SET cell_version = $3, document_class = $4, intensity = $5, selected_evidence = $6, rationale = $7, insufficient_context = $8,
            version = version + 1, updated_at = now()
      WHERE cell_id = $1 AND evaluator_id = $2 AND version = $9 AND finalized_at IS NULL RETURNING version, updated_at`,
    [cellId, evaluator.id, v.version, ...vals, expectedVersion])
  if (!upd.rows[0]) throw new EvalError(409, 'Conflicto de edición: el borrador cambió en otro sitio', { currentVersion: cur?.version ?? null })
  return { version: upd.rows[0].version as number, updatedAt: upd.rows[0].updated_at }
}

/** Finalización irreversible: borrador → `position_codings` (solo añadir) en una transacción. */
export async function finalizeEvaluation(pool: TxPool, evaluator: Evaluator, campaignId: string, cellId: string, expectedVersion: number, cellVersion: number) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const c = await requireAssignment(db, evaluator.id, campaignId, cellId)
    if (c.status !== 'open') throw new EvalError(409, 'La campaña no está abierta')
    const { rows: [d] } = await db.query('SELECT * FROM eval_drafts WHERE cell_id = $1 AND evaluator_id = $2 FOR UPDATE', [cellId, evaluator.id])
    if (!d) throw new EvalError(409, 'No hay borrador que finalizar')
    if (d.finalized_at) throw new EvalError(409, 'La evaluación ya está finalizada')
    if (d.version !== expectedVersion) throw new EvalError(409, 'Conflicto de edición: el borrador cambió', { currentVersion: d.version })
    const v = await latestVersion(db, cellId)
    if (cellVersion !== v.version || d.cell_version !== v.version) throw new EvalError(409, 'La celda tiene una versión más reciente; revisa la evaluación', { currentCellVersion: v.version })

    const cls = d.document_class as DocumentClass | null
    if (!cls && !d.insufficient_context) throw new EvalError(422, 'Elige una clase documental o marca «contexto insuficiente»')
    let intensity: number | null = null
    if (cls) {
      const allowed = INTENSITY_BY_CLASS[cls]
      if (allowed.length === 1) intensity = allowed[0]
      else if (allowed.length > 1) {
        if (d.intensity == null) throw new EvalError(422, 'Indica la intensidad')
        if (!allowed.includes(d.intensity)) throw new EvalError(422, 'La intensidad no es coherente con la clase')
        intensity = d.intensity
      }
      const evidence: number[] = d.selected_evidence ?? []
      if (['supports', 'opposes', 'explicit_neutral'].includes(cls) && evidence.length === 0) throw new EvalError(422, 'Selecciona al menos una evidencia que sostenga la decisión')
      if (cls !== 'not_mentioned' && !String(d.rationale).trim()) throw new EvalError(422, 'Escribe una justificación')
    }
    // «Contexto insuficiente» es un campo propio: puede ir sin clase (no se obliga a puntuar) o acompañando a una clase.
    const finalClass = cls
    const sel: number[] = d.selected_evidence ?? []
    const evidence = sel.map((i) => ({ index: i, page: v.snapshot.passages[i]?.page ?? null, text: v.snapshot.passages[i]?.text ?? '' }))
    const { rows: others } = await db.query(`SELECT DISTINCT evaluator_label FROM position_codings WHERE question_id = $1 AND entity_id = $2 AND evaluator_id IS DISTINCT FROM $3`, [c.question_id, c.entity_id, evaluator.id])
    const ins = await db.query(
      `INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, blind, independent_of, item_text_sha256, context_sha256, manual_version, source_sha256,
                                     config, execution_status, document_class, intensity, evidence, rationale, insufficient_context, campaign_id, evaluator_id, revision, cell_version)
       VALUES ($1,$2,$3,'human',$4,true,$5,$6,$7,$8,$9,$10,'ok',$11,$12,$13,$14,$15,$16,$17,1,$18) RETURNING id`,
      [campaignId, c.entity_id, c.question_id, evaluator.label, others.map((o: any) => o.evaluator_label), sha256(v.snapshot.item), sha256(v.snapshot.context ?? ''), c.manual_version, v.sha256,
        JSON.stringify({ affiliation: evaluator.affiliation, independent_human_reference: false, campaign_id: campaignId, cell_id: cellId, cell_version: v.version, draft_version: d.version, blind_backend: true }),
        finalClass, intensity, JSON.stringify(evidence), String(d.rationale ?? ''), !!d.insufficient_context, campaignId, evaluator.id, v.version])
    await db.query('UPDATE eval_drafts SET finalized_at = now(), coding_id = $1 WHERE id = $2', [ins.rows[0].id, d.id])
    await audit(db, evaluator.id, 'finalize', campaignId, cellId, { coding_id: ins.rows[0].id, class: finalClass, insufficient_context: !!d.insufficient_context })
    await db.query('COMMIT')
    return { codingId: ins.rows[0].id as string }
  } catch (e) {
    try { await db.query('ROLLBACK') } catch { /* ya revertida */ }
    throw e
  } finally {
    db.release()
  }
}

/** Petición de contexto adicional: no obliga a emitir una puntuación. */
export async function requestContext(db: Queryable, evaluator: Evaluator, campaignId: string, cellId: string, note: string) {
  const c = await requireAssignment(db, evaluator.id, campaignId, cellId)
  if (c.status !== 'open') throw new EvalError(409, 'La campaña no está abierta')
  const { rows: [d] } = await db.query('SELECT finalized_at FROM eval_drafts WHERE cell_id = $1 AND evaluator_id = $2', [cellId, evaluator.id])
  if (d?.finalized_at) throw new EvalError(409, 'La evaluación ya está finalizada')
  const { rows: [open] } = await db.query(`SELECT id FROM eval_context_requests WHERE cell_id = $1 AND evaluator_id = $2 AND status = 'open'`, [cellId, evaluator.id])
  if (open) { await db.query('UPDATE eval_context_requests SET note = $1 WHERE id = $2', [String(note).slice(0, 2000), open.id]); return { id: open.id as string, updated: true } }
  const { rows: [r] } = await db.query('INSERT INTO eval_context_requests (cell_id, evaluator_id, note) VALUES ($1,$2,$3) RETURNING id', [cellId, evaluator.id, String(note).slice(0, 2000)])
  await audit(db, evaluator.id, 'context_requested', campaignId, cellId, { note: String(note).slice(0, 200) })
  return { id: r.id as string, updated: false }
}

const MAX_EXPANDED = 30

/**
 * Atiende la petición de contexto: crea una VERSIÓN NUEVA de la celda con los pasajes contiguos (páginas ±1) a los ya mostrados.
 * Los pasajes anteriores conservan su posición, de modo que las evidencias ya seleccionadas siguen siendo válidas. No modifica la versión original.
 * Ciego: el contexto adicional se calcula al crear la campaña (`eval_cells.extra_context`, sin partido) y aquí solo se incorpora.
 */
export async function resolveContextRequest(db: Queryable, evaluator: Evaluator, campaignId: string, cellId: string) {
  const c = await requireAssignment(db, evaluator.id, campaignId, cellId)
  if (c.status !== 'open') throw new EvalError(409, 'La campaña no está abierta')
  const { rows: [req] } = await db.query(`SELECT id FROM eval_context_requests WHERE cell_id = $1 AND evaluator_id = $2 AND status = 'open' ORDER BY requested_at DESC LIMIT 1`, [cellId, evaluator.id])
  if (!req) throw new EvalError(409, 'No hay petición de contexto abierta')
  const v = await latestVersion(db, cellId)
  const { rows: [ec] } = await db.query('SELECT extra_context FROM eval_cells WHERE id = $1', [cellId])
  const rows: EvalPassage[] = Array.isArray(ec?.extra_context) ? ec.extra_context : []
  const have = new Set(v.snapshot.passages.map((p) => `${p.page}|${p.text.trim()}`))
  const added: EvalPassage[] = []
  for (const r of rows) { const k = `${r.page}|${String(r.text).trim()}`; if (!have.has(k)) { have.add(k); added.push({ page: r.page ?? null, text: r.text }); if (added.length >= MAX_EXPANDED) break } }
  if (!added.length) {
    await db.query(`UPDATE eval_context_requests SET status = 'resolved', resolved_at = now(), resolved_version = $1 WHERE id = $2`, [v.version, req.id])
    await audit(db, evaluator.id, 'context_resolved_no_new_passages', campaignId, cellId, { version: v.version })
    return { version: v.version, added: 0 }
  }
  const snap: EvalSnapshot = { ...v.snapshot, passages: [...v.snapshot.passages, ...added] }
  const newVersion = v.version + 1
  await db.query('INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ($1,$2,$3,$4,$5)',
    [cellId, newVersion, JSON.stringify(snap), sha256(JSON.stringify(snap)), `contexto ampliado a petición del evaluador (+${added.length} pasajes de páginas contiguas)`])
  await db.query(`UPDATE eval_context_requests SET status = 'resolved', resolved_at = now(), resolved_version = $1 WHERE id = $2`, [newVersion, req.id])
  await audit(db, evaluator.id, 'context_resolved', campaignId, cellId, { from: v.version, to: newVersion, added: added.length })
  return { version: newVersion, added: added.length }
}
