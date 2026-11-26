// Aplica a `positions` (BD LOCAL) las adjudicaciones vigentes del piloto y de la campaña de 150, por ORDEN EXPRESA de la persona responsable (2026-11-26: «esto, ¿por qué no?»).
// Las adjudicaciones las produjo una IA (consta en cada justificación y en eval_authorship): los cambios quedan marcados `reviewed_by = adjudicacion-ia` y SIN verificación humana. Solo-lectura por defecto.
// Reglas: add_position → crea o actualiza la fila de esa celda (aprobada, con la evidencia verificada de la adjudicación); correct_registered → cambia valor y evidencia; remove_registered → rechaza la fila.
// confirm_registered / no_change → sin cambios. Se OMITEN las celdas de preguntas que ya se han dividido en preguntas nuevas (hay que mapearlas a su mitad) y las que no traen evidencia. Todo queda en editorial_audit con el valor anterior.
//   node scripts/methodology/apply_adjudications.mjs            # simulación
//   node scripts/methodology/apply_adjudications.mjs --apply
import pg from 'pg'
const APPLY = process.argv.includes('--apply')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
const { rows } = await c.query(`
  SELECT DISTINCT ON (a.cell_id) pc.document_class AS ev_cls, pc.evidence AS ev_evidence, a.id AS adj_id, a.cell_id, a.revision, a.document_class AS cls, a.intensity AS int, a.proposed_action AS action, a.evidence, a.rationale, a.causes,
         ce.question_id, ce.entity_id, ce.ord, k.name AS campaign, q.pilot_question_id AS pq, e.name AS party,
         EXISTS (SELECT 1 FROM questions h WHERE h.pilot_question_id = q.pilot_question_id || 'a' AND h.status = 'draft') AS dividida
    FROM eval_adjudications a LEFT JOIN position_codings pc ON pc.id = a.own_coding_id JOIN eval_cells ce ON ce.id = a.cell_id JOIN eval_campaigns k ON k.id = ce.campaign_id JOIN questions q ON q.id = ce.question_id JOIN entities e ON e.id = ce.entity_id
   ORDER BY a.cell_id, a.revision DESC`)
const plan = { add: [], correct: [], remove: [], omitidas: [] }
for (const r of rows) {
  if (!['add_position', 'correct_registered', 'remove_registered'].includes(r.action)) continue
  // Evidencia: la verificada en la adjudicación; si no hay, la que SELECCIONÓ la evaluación (frases literales de los pasajes recuperados) solo cuando su clase coincide con la adjudicada
  let ev = (r.evidence ?? []).filter((x) => String(x.text ?? '').trim()); if (!ev.length && r.ev_cls && r.ev_cls === r.cls) ev = (r.ev_evidence ?? []).filter((x) => String(x.text ?? '').trim()).map((x) => ({ page: x.page, text: x.text }))
  if (r.dividida) { plan.omitidas.push({ pq: r.pq, party: r.party, accion: r.action, motivo: 'pregunta dividida: mapear a su mitad' }); continue }
  if (r.action !== 'remove_registered' && r.cls && r.cls !== 'ambiguous' && !ev.length) { plan.omitidas.push({ pq: r.pq, party: r.party, accion: r.action, motivo: 'sin evidencia en la adjudicación' }); continue }
  const { rows: [pos] } = await c.query('SELECT * FROM positions WHERE question_id = $1 AND entity_id = $2', [r.question_id, r.entity_id])
  if (pos?.review_status === 'rejected' && r.action === 'add_position') { plan.omitidas.push({ pq: r.pq, party: r.party, accion: r.action, motivo: 'estaba RECHAZADA por revisión editorial previa: no se revierte sin decisión expresa' }); continue }
  const op = { r, pos, ev }
  if (r.action === 'add_position') plan.add.push(op); else if (r.action === 'correct_registered') { if (!pos) { plan.omitidas.push({ pq: r.pq, party: r.party, accion: r.action, motivo: 'no hay posición que corregir' }); continue } plan.correct.push(op) } else { if (!pos) { plan.omitidas.push({ pq: r.pq, party: r.party, accion: r.action, motivo: 'no hay posición que retirar' }); continue } plan.remove.push(op) }
}
const val = (r) => (r.cls === 'supports' || r.cls === 'opposes' ? r.int : r.cls === 'explicit_neutral' ? 0 : null)
console.log(`Añadir ${plan.add.length} · Corregir ${plan.correct.length} · Retirar ${plan.remove.length} · Omitidas ${plan.omitidas.length}`)
for (const [k, a] of Object.entries({ añadir: plan.add, corregir: plan.correct, retirar: plan.remove })) for (const o of a) console.log(`${k} ${o.r.pq} ${o.r.party}: ${o.pos ? `${o.pos.review_status}/${o.pos.value ?? '-'}` : 'sin fila'} → ${o.r.action === 'remove_registered' ? 'rechazada' : `${o.r.cls} ${val(o.r.cls ? o.r : o.r) ?? ''}`}${o.pos?.review_status === 'rejected' ? '  ⚠ estaba RECHAZADA por revisión editorial' : ''}`)
console.log('Omitidas:', JSON.stringify(plan.omitidas))
if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); c.release(); await pool.end(); process.exit(0) }
const NOTE = (r, before) => `Adjudicación realizada por IA, sin verificación humana (2026-11-26), por orden de la persona responsable. Acción ${r.action}; causas: ${(r.causes ?? []).join(', ')}. Antes: ${before}. Ajudicación ${r.adj_id}.`
const mkEv = (r, ev) => ev.map((x) => ({ source: 'adjudicacion-ia', stance: r.cls, source_page: x.page ?? null, literal_text: x.text, translation_es: null, conditions: '', affected_area: '', normalized_text: '', review_status: 'approved' }))
try {
  await c.query('BEGIN')
  for (const o of plan.add) { const r = o.r; const v = val(r); const stance = r.cls === 'ambiguous' ? 'ambiguous' : 'approved'; const before = o.pos ? `${o.pos.review_status}/${o.pos.value ?? '-'}` : 'sin fila'
    if (o.pos) { await c.query(`UPDATE positions SET value = $1, review_status = 'approved', stance_status = $2, evidence_jsonb = $3, reviewed_by = 'adjudicacion-ia', reviewed_at = now(), review_note = $4 WHERE id = $5`, [v, stance, JSON.stringify(mkEv(r, o.ev)), NOTE(r, before), o.pos.id])
      await c.query(`INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('adjudicacion-ia','set_value','position',$1,$2,$3)`, [o.pos.id, 'Posición añadida por adjudicación (IA)', JSON.stringify({ antes: before, despues: `${r.cls} ${v}` })]) }
    else { const { rows: [n] } = await c.query(`INSERT INTO positions (entity_id, question_id, value, review_status, stance_status, evidence_jsonb, reviewed_by, reviewed_at, review_note) VALUES ($1,$2,$3,'approved',$4,$5,'adjudicacion-ia',now(),$6) RETURNING id`, [r.entity_id, r.question_id, v, stance, JSON.stringify(mkEv(r, o.ev)), NOTE(r, before)])
      await c.query(`INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('adjudicacion-ia','seed_position','position',$1,$2,$3)`, [n.id, 'Posición creada por adjudicación (IA)', JSON.stringify({ antes: before, despues: `${r.cls} ${v}` })]) } }
  for (const o of plan.correct) { const r = o.r; const v = val(r); const stance = r.cls === 'ambiguous' ? 'ambiguous' : o.pos.stance_status === 'ambiguous' ? 'approved' : o.pos.stance_status; const before = `${o.pos.review_status}/${o.pos.value ?? '-'}`
    await c.query(`UPDATE positions SET value = $1, stance_status = $2, evidence_jsonb = $3, reviewed_by = 'adjudicacion-ia', reviewed_at = now(), review_note = $4 WHERE id = $5`, [v, stance, o.ev.length ? JSON.stringify(mkEv(r, o.ev)) : o.pos.evidence_jsonb, NOTE(r, before), o.pos.id])
    await c.query(`INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('adjudicacion-ia','set_value','position',$1,$2,$3)`, [o.pos.id, 'Posición corregida por adjudicación (IA)', JSON.stringify({ antes: before, despues: `${r.cls} ${v}` })]) }
  for (const o of plan.remove) { const r = o.r; const before = `${o.pos.review_status}/${o.pos.value ?? '-'}`
    await c.query(`UPDATE positions SET review_status = 'rejected', reviewed_by = 'adjudicacion-ia', reviewed_at = now(), review_note = $1 WHERE id = $2`, [NOTE(r, before), o.pos.id])
    await c.query(`INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('adjudicacion-ia','reject','position',$1,$2,$3)`, [o.pos.id, 'Posición retirada por adjudicación (IA)', JSON.stringify({ antes: before, despues: 'rechazada' })]) }
  await c.query('COMMIT'); console.log('Aplicado.')
} catch (e) { await c.query('ROLLBACK'); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
