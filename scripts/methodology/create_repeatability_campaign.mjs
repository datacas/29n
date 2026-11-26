// Crea en la BD LOCAL una campaña de REPETIBILIDAD INTRAEVALUADOR: vuelve a presentar, en orden aleatorio nuevo y con etiquetas nuevas, una muestra de celdas que
// el evaluador ya finalizó en otra campaña. La interfaz no muestra la respuesta anterior; ambas evaluaciones se conservan (son filas distintas de `position_codings`).
// La repetibilidad intraevaluador NO equivale a fiabilidad entre humanos independientes.
//   node scripts/methodology/create_repeatability_campaign.mjs --source <campaign_id> [--n 10] [--seed 7] [--min-days 7] [--allow-early] [--apply]
//   --design: usa las celdas PREINSCRITAS para repetibilidad en el diseño muestral (eval_sample_design.repeat_selected) en vez de una muestra al azar (la selección no puede depender de los resultados)
import crypto from 'node:crypto'
import pg from 'pg'
import { rng } from './lib.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d }
const SOURCE = arg('source'); const N = Number(arg('n', 10)); const SEED = Number(arg('seed', 7)); const MIN_DAYS = Number(arg('min-days', 7))
const DESIGN = process.argv.includes('--design'); const APPLY = process.argv.includes('--apply'); const EARLY = process.argv.includes('--allow-early')
if (!SOURCE) { console.error('Falta --source <campaign_id>'); process.exit(1) }
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const c = await pool.connect()
try {
  const { rows: [src] } = await c.query('SELECT * FROM eval_campaigns WHERE id = $1', [SOURCE]); if (!src) throw new Error('Campaña de origen no encontrada')
  const { rows: fin } = await c.query(
    `SELECT ce.id AS cell_id, ce.question_id, ce.entity_id, ce.party_name, ce.extra_context, d.evaluator_id, d.finalized_at, d.cell_version
       FROM eval_cells ce JOIN eval_drafts d ON d.cell_id = ce.id AND d.finalized_at IS NOT NULL WHERE ce.campaign_id = $1 ORDER BY ce.ord`, [SOURCE])
  if (!fin.length) throw new Error('La campaña de origen no tiene evaluaciones finalizadas')
  const youngest = Math.min(...fin.map((f) => (Date.now() - new Date(f.finalized_at).getTime()) / 864e5))
  console.log(`Origen «${src.name}»: ${fin.length} celdas finalizadas; la más reciente hace ${youngest.toFixed(1)} días (mínimo recomendado: ${MIN_DAYS}).`)
  if (youngest < MIN_DAYS && !EARLY) throw new Error('Demasiado pronto: la memoria de la primera evaluación sesgaría la repetición. Espera o usa --allow-early (queda documentado).')
  const r = rng(SEED)
  let pick
  if (DESIGN) {
    const { rows: pre } = await c.query('SELECT cell_id FROM eval_sample_design WHERE repeat_selected'); const set = new Set(pre.map((x) => x.cell_id))
    pick = fin.filter((f) => set.has(f.cell_id)); const missing = set.size - pick.length
    if (missing > 0) throw new Error(`Faltan ${missing} celdas preinscritas por finalizar en la campaña de origen`)
  } else pick = fin.map((f) => [r(), f]).sort((a, b) => a[0] - b[0]).slice(0, Math.min(N, fin.length)).map((x) => x[1])
  console.log(`Muestra aleatoria de ${pick.length} celdas (semilla ${SEED}) y orden nuevo.`)
  if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); process.exit(0) }
  await c.query('BEGIN')
  const name = `Repetibilidad de «${src.name}» (n=${pick.length}, semilla ${SEED})`
  const { rows: [camp] } = await c.query(
    `INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note, source_campaign_id)
     VALUES ($1,'repeatability','open',$2,$3,$4,$5,$6) RETURNING id`,
    [name, src.manual_version, src.manual_text,
      `${DESIGN ? 'Celdas PREINSCRITAS en el diseño muestral (semilla fija, independientes de los resultados)' : 'Muestra ALEATORIA'} de ${pick.length} de las ${fin.length} celdas finalizadas en la campaña de origen, en orden y con etiquetas nuevos; se repite sin mostrar la respuesta anterior. Espera mínima entre evaluaciones: ${youngest.toFixed(1)} días${youngest < MIN_DAYS ? ' (por debajo del mínimo recomendado, --allow-early)' : ''}.`,
      'Mide la repetibilidad del MISMO evaluador interno (test–retest). No equivale a fiabilidad entre humanos independientes; el evaluador puede recordar parte de las celdas.', SOURCE])
  for (const [n, f] of pick.entries()) {
    const { rows: [v] } = await c.query('SELECT snapshot, sha256 FROM eval_cell_versions WHERE cell_id = $1 AND version = $2', [f.cell_id, f.cell_version])
    const { rows: [cell] } = await c.query(
      `INSERT INTO eval_cells (campaign_id, ord, question_id, entity_id, blind_label, party_name, extra_context) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [camp.id, n + 1, f.question_id, f.entity_id, `Partido ${String.fromCharCode(65 + ((n * 7 + 3) % 26))}${n + 1}`, f.party_name, JSON.stringify(f.extra_context)])
    await c.query('INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ($1,1,$2,$3,$4)', [cell.id, JSON.stringify(v.snapshot), sha(JSON.stringify(v.snapshot)), `repetición de la versión ${f.cell_version} de la celda de origen`])
    await c.query('INSERT INTO eval_assignments (cell_id, evaluator_id) VALUES ($1,$2)', [cell.id, f.evaluator_id])
  }
  await c.query('INSERT INTO eval_audit (action, campaign_id, detail) VALUES ($1,$2,$3)', ['campaign_created', camp.id, JSON.stringify({ kind: 'repeatability', source: SOURCE, cells: pick.length })])
  await c.query('COMMIT'); console.log(`Campaña de repetibilidad creada: ${camp.id}`)
} catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
