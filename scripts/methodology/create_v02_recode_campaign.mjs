// Prepara (en BORRADOR, sin asignar a nadie) la campaña ciega de recodificación con el manual v0.2-borrador para un SEGUNDO EVALUADOR HUMANO (persona):
// las celdas del piloto cuyo desacuerdo se atribuyó al manual (ords 6, 7, 12, 15, 3) más controles al azar (para que no se sepa cuáles son las «del manual»), en orden y con etiquetas nuevos.
//   node scripts/methodology/create_v02_recode_campaign.mjs            # simulación
//   node scripts/methodology/create_v02_recode_campaign.mjs --apply            # crea la campaña en estado `draft`, sin evaluadores asignados
//   node scripts/methodology/create_v02_recode_campaign.mjs --apply --open     # además la abre y la asigna a «Humano interno 1» (decisión de la persona que va a evaluar)
// NO la abre ni la asigna: hace falta (1) ratificación de las decisiones del manual por la persona responsable (D26), (2) una persona evaluadora distinta de quien escribió las reglas
// y que no haya visto la referencia, las respuestas de IA ni las adjudicaciones, y (3) un mecanismo de acceso para esa persona (hoy solo existe el acceso del administrador local).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'
import { ROOT, rng } from './lib.mjs'
const APPLY = process.argv.includes('--apply'); const OPEN = process.argv.includes('--open')   // --open: la abre y la asigna al evaluador «Humano interno 1» (la persona que evalúa)
 const TARGET = [6, 7, 12, 15, 3]; const CONTROL_POOL = [1, 4, 5, 8, 9, 11, 13, 14, 17, 18]; const N_CONTROL = 3
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const manual = fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.2-borrador.md'), 'utf8').replace(/## Salida[\s\S]*?(?=## Importante)/, '')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
try {
  const { rows: [src] } = await c.query(`SELECT id FROM eval_campaigns WHERE kind = 'pilot' ORDER BY created_at LIMIT 1`)
  const r = rng(402); const controls = CONTROL_POOL.map((o) => [r(), o]).sort((a, b) => a[0] - b[0]).slice(0, N_CONTROL).map((x) => x[1])
  const picks = [...TARGET, ...controls]; const order = picks.map((o) => [r(), o]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
  const { rows: cells } = await c.query(`SELECT ce.id, ce.ord, ce.question_id, ce.entity_id, ce.party_name, ce.extra_context FROM eval_cells ce WHERE ce.campaign_id = $1 AND ce.ord = ANY($2) `, [src.id, picks])
  const by = Object.fromEntries(cells.map((x) => [x.ord, x]))
  console.log(`Campaña de recodificación v0.2 (borrador): ${order.length} celdas (${TARGET.length} del manual + ${N_CONTROL} controles al azar), orden aleatorio (semilla 402). Sin asignar.`)
  if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply cuando las decisiones estén ratificadas.'); process.exit(0) }
  await c.query('BEGIN')
  const NAME = 'Recodificación con manual v0.2 (borrador) — segundo evaluador humano'
  if ((await c.query('SELECT 1 FROM eval_campaigns WHERE name = $1', [NAME])).rowCount) throw new Error('La campaña ya existe')
  const { rows: [camp] } = await c.query(
    `INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note, source_campaign_id) VALUES ($1,'main',$6,'0.2-borrador',$2,$3,$4,$5) RETURNING id`,
    [NAME, manual, `${TARGET.length} celdas del piloto cuyo desacuerdo se atribuyó al manual más ${N_CONTROL} controles al azar, mezcladas y con etiquetas nuevas. Evalúa una PERSONA que no haya escrito las reglas ni visto la referencia, las IA o las adjudicaciones.`,
      'Muestra dirigida y minúscula: sirve para comprobar si las reglas v0.2 resuelven los desacuerdos de manual, no para estimar fiabilidad. Procedencia a verificar (eval_provenance): se registra como humana solo cuando la persona lo declara.', src.id, OPEN ? 'open' : 'draft'])
  for (const [n, ord] of order.entries()) {
    const x = by[ord]; const { rows: [v] } = await c.query('SELECT snapshot FROM eval_cell_versions WHERE cell_id = $1 AND version = 1', [x.id])
    const { rows: [cell] } = await c.query(`INSERT INTO eval_cells (campaign_id, ord, question_id, entity_id, blind_label, party_name, extra_context) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [camp.id, n + 1, x.question_id, x.entity_id, `Partido ${String.fromCharCode(65 + ((n * 5 + 2) % 26))}${n + 1}`, x.party_name, JSON.stringify(x.extra_context)])
    await c.query('INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ($1,1,$2,$3,$4)', [cell.id, JSON.stringify(v.snapshot), sha(JSON.stringify(v.snapshot)), 'instantánea de la celda del piloto (recuperación B-1.0.0)'])
    if (OPEN) { const { rows: [ev] } = await c.query(`SELECT id FROM eval_evaluators WHERE label = 'Humano interno 1'`); await c.query('INSERT INTO eval_assignments (cell_id, evaluator_id) VALUES ($1,$2)', [cell.id, ev.id]) }
  }
  await c.query('INSERT INTO eval_audit (action, campaign_id, detail) VALUES ($1,$2,$3)', ['campaign_created', camp.id, JSON.stringify({ kind: 'recode_v02_draft', cells: order.length })])
  await c.query('COMMIT'); console.log(`Campaña creada (${OPEN ? 'abierta y asignada a «Humano interno 1»' : 'borrador, sin asignar'}): ${camp.id}`)
} catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
