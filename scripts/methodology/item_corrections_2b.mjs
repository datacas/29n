// Añadido tras revisión: SALF en Q005a = opposes −1. «El IBI se elimina por completo, para todos» no puede conciliarse con subir el IBI a nadie (signo claro); −1 y no −2 porque la cita no nombra las viviendas vacías ni acumuladas. Codificación por IA, sin verificación humana.
import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
try {
  await c.query('BEGIN')
  const { rows: [h] } = await c.query(`SELECT id FROM questions WHERE pilot_question_id = 'Q005a'`)
  const { rows: [p] } = await c.query(`SELECT p.* FROM positions p JOIN questions q ON q.id = p.question_id JOIN entities e ON e.id = p.entity_id WHERE q.pilot_question_id = 'Q005' AND e.name = 'SALF' AND p.review_status = 'approved'`)
  if ((await c.query('SELECT 1 FROM positions WHERE question_id = $1 AND entity_id = $2', [h.id, p.entity_id])).rowCount) { console.log('ya existe'); await c.query('ROLLBACK'); process.exit(0) }
  const ev = (p.evidence_jsonb ?? []).filter((e) => /IBI/.test(e.literal_text ?? '')).map((e) => ({ ...e, stance: 'opposes' })); if (!ev.length) throw new Error('sin cita del IBI')
  const { rows: [n] } = await c.query(`INSERT INTO positions (entity_id, question_id, claim_id, value, categorical_value, evidence_summary, conditions, review_status, stance_status, evidence_jsonb, reviewed_by, reviewed_at, review_note) VALUES ($1,$2,NULL,-1,NULL,$3,$4,'approved','approved',$5,'correccion-items-ia',now(),$6) RETURNING id`,
    [p.entity_id, h.id, p.evidence_summary, p.conditions, JSON.stringify(ev), `Nueva en Q005a a partir de la cita de ${p.id}: eliminar el IBI por completo se opone a subirlo; −1 (no −2) porque la cita no nombra viviendas vacías ni acumuladas. Codificación por IA, sin verificación humana.`])
  await c.query(`INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('correccion-items-ia','seed_position','position',$1,'SALF en Q005a (opposes -1)',$2)`, [n.id, JSON.stringify({ despues: 'opposes -1' })])
  await c.query('COMMIT'); console.log('SALF Q005a = -1 (' + ev.length + ' cita)')
} catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
// Retirada también: Adelante Andalucía en Q005a (rechazada en BD local: la cita habla de viviendas turísticas y de inversión, no del objeto). Q018b se excluye a mano de la 2.2.1 (un solo partido).
