// Registra (solo añadir) una NUEVA REVISIÓN de adjudicación de una celda del piloto, con las mismas garantías que la pantalla (puerta de evaluación propia finalizada, revisión consecutiva, applied=false).
// Uso excepcional, por orden expresa de la persona responsable; la pantalla /admin/adjudicacion es la vía normal. NO toca positions ni el banco.
//   node scripts/methodology/register_adjudication.mjs --ord 12 --class not_mentioned --causes manual_insufficient,interpretation_error --action remove_registered --manual 0.2 --rationale-file ruta.txt [--evidence-file ruta.json]
import fs from 'node:fs'
import pg from 'pg'
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d }
const ord = Number(arg('ord')); const cls = arg('class') === 'null' ? null : arg('class'); const intensity = arg('intensity') != null ? Number(arg('intensity')) : null
const causes = String(arg('causes', '')).split(',').filter(Boolean); const action = arg('action', null); const manual = arg('manual', null)
const rationale = fs.readFileSync(arg('rationale-file'), 'utf8').trim(); const evidence = arg('evidence-file') ? JSON.parse(fs.readFileSync(arg('evidence-file'), 'utf8')) : []
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
try {
  await c.query('BEGIN')
  const { rows: [cell] } = await c.query(`SELECT ce.id AS cell_id, d.evaluator_id, d.coding_id, d.cell_version FROM eval_cells ce JOIN eval_campaigns k ON k.id = ce.campaign_id AND k.kind = 'pilot'
     JOIN eval_drafts d ON d.cell_id = ce.id AND d.finalized_at IS NOT NULL WHERE ce.ord = $1`, [ord]); if (!cell) throw new Error('Celda sin evaluación propia finalizada')
  const { rows: [last] } = await c.query('SELECT max(revision)::int AS r FROM eval_adjudications WHERE cell_id = $1 AND adjudicator_id = $2', [cell.cell_id, cell.evaluator_id])
  const { rows: [r] } = await c.query(
    `INSERT INTO eval_adjudications (cell_id, adjudicator_id, document_class, intensity, rationale, causes, proposed_action, evidence, own_coding_id, manual_version, cell_version, revision)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, revision`,
    [cell.cell_id, cell.evaluator_id, cls, intensity, rationale, causes, action, JSON.stringify(evidence), cell.coding_id, manual, cell.cell_version, (last?.r ?? 0) + 1])
  await c.query('INSERT INTO eval_audit (evaluator_id, action, cell_id, detail) VALUES ($1,$2,$3,$4)', [cell.evaluator_id, 'adjudicated', cell.cell_id, JSON.stringify({ revision: r.revision, class: cls, causes, via: 'register_adjudication.mjs' })])
  await c.query('COMMIT'); console.log(`Registrada la revisión ${r.revision} de la celda ${ord}`)
} catch (e) { await c.query('ROLLBACK'); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
