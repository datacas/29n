// Aplica a `positions` (BD LOCAL) las 10 decisiones sobre las MITADES de preguntas divididas (docs/methodology/local/PENDIENTES_decididas.md, sección A).
// Decididas por IA (no por una persona) a petición del responsable el 2026-11-26. Mismo formato y marcas que apply_adjudications.mjs (reviewed_by = adjudicacion-ia). Simulación por defecto; --apply para escribir.
import pg from 'pg'
const APPLY = process.argv.includes('--apply')
const OPS = [
  ['Q008', 'Q008b', 'PP', 'opposes', -1, /Derogaremos|índice|tensionad/i],
  ['Q008', 'Q008b', 'Partido Autónomos', 'opposes', -1, /./],
  ['Q011', 'Q011a', 'EH Bildu', 'opposes', -1, /Alta Velocidad/],
  ['Q011', 'Q011a', 'Democracia21', 'opposes', -1, /alta velocidad|Conservar antes/i],
  ['Q055', 'Q055a', 'Democracia21', 'supports', 1, /desalación/i],
  ['Q055', 'Q055b', 'Adelante Andalucía', 'opposes', -1, /./],
  ['Q120', 'Q120a', 'Democracia21', 'supports', 2, /./],
  ['Q120', 'Q120a', 'Frente Obrero', 'supports', 1, /elección por parte del Gobierno/i],
  ['Q120', 'Q120a', 'Adelante Andalucía', 'supports', 2, /./],
  ['Q120', 'Q120b', 'Adelante Andalucía', 'supports', 2, /./]]
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
const plan = []
for (const [orig, half, party, cls, v, re] of OPS) {
  const { rows: [h] } = await c.query('SELECT id FROM questions WHERE pilot_question_id = $1 AND status = $2', [half, 'draft'])
  const { rows: [e] } = await c.query('SELECT id FROM entities WHERE name = $1', [party])
  const { rows: [a] } = await c.query(`SELECT a.id, a.evidence, pc.evidence AS ev2 FROM eval_adjudications a JOIN eval_cells ce ON ce.id = a.cell_id JOIN questions q ON q.id = ce.question_id JOIN entities en ON en.id = ce.entity_id LEFT JOIN position_codings pc ON pc.id = a.own_coding_id WHERE q.pilot_question_id = $1 AND en.name = $2 ORDER BY a.revision DESC LIMIT 1`, [orig, party])
  if (!h || !e || !a) throw new Error(`falta dato: ${orig} ${half} ${party}`)
  const all = [...(a.evidence ?? []), ...(a.ev2 ?? [])].filter((x) => String(x.text ?? '').trim()); const seen = new Set(); let ev = all.filter((x) => (seen.has(x.text) ? false : seen.add(x.text)) && re.test(x.text))
  if (!ev.length) throw new Error(`sin evidencia que case: ${half} ${party}`)
  const { rows: [pos] } = await c.query('SELECT * FROM positions WHERE question_id = $1 AND entity_id = $2', [h.id, e.id])
  plan.push({ half, party, cls, v, ev, pos, hid: h.id, eid: e.id, adj: a.id })
  console.log(`${half} ${party}: ${pos ? `${pos.review_status}/${pos.value ?? '-'}` : 'sin fila'} → ${cls} ${v} (${ev.length} cita/s, p. ${ev.map((x) => x.page ?? x.source_page ?? '?').join(',')})`)
}
if (!APPLY) { console.log('Simulación: no se ha escrito nada.'); c.release(); await pool.end(); process.exit(0) }
try {
  await c.query('BEGIN')
  for (const o of plan) {
    const before = o.pos ? `${o.pos.review_status}/${o.pos.value ?? '-'}` : 'sin fila'
    const evj = JSON.stringify(o.ev.map((x) => ({ source: 'adjudicacion-ia', stance: o.cls, source_page: x.page ?? x.source_page ?? null, literal_text: x.text, translation_es: null, conditions: '', affected_area: '', normalized_text: '', review_status: 'approved' })))
    const note = `Adjudicación realizada por IA, sin verificación humana (2026-11-26), por orden de la persona responsable, aplicada a la mitad ${o.half} de una pregunta dividida. Antes: ${before}. Adjudicación ${o.adj}.`
    let id
    if (o.pos) { id = o.pos.id; await c.query(`UPDATE positions SET value = $1, review_status = 'approved', stance_status = 'approved', evidence_jsonb = $2, reviewed_by = 'adjudicacion-ia', reviewed_at = now(), review_note = $3 WHERE id = $4`, [o.v, evj, note, id]) }
    else { ({ rows: [{ id }] } = await c.query(`INSERT INTO positions (entity_id, question_id, value, review_status, stance_status, evidence_jsonb, reviewed_by, reviewed_at, review_note) VALUES ($1,$2,$3,'approved','approved',$4,'adjudicacion-ia',now(),$5) RETURNING id`, [o.eid, o.hid, o.v, evj, note])) }
    await c.query(`INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('adjudicacion-ia',$1,'position',$2,$3,$4)`, [o.pos ? 'set_value' : 'seed_position', id, `Posición de ${o.half} fijada por adjudicación (IA)`, JSON.stringify({ antes: before, despues: `${o.cls} ${o.v}` })])
  }
  await c.query('COMMIT'); console.log('Aplicado.')
} catch (e) { await c.query('ROLLBACK'); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
