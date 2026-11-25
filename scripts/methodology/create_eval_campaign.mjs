// Crea en la BD LOCAL la campaña de evaluación humana ciega del piloto (19 celdas, modalidad B, conjunto S). No llama a modelos ni toca el banco, el scoring ni las posiciones.
//   node scripts/methodology/create_eval_campaign.mjs            # simulación: muestra qué crearía
//   node scripts/methodology/create_eval_campaign.mjs --apply    # crea la campaña (idempotente: aborta si ya existe una con el mismo nombre)
// Requiere haber generado `docs/methodology/local/out/pilot_cells.json` (build_adjudication_sheets.mjs) y aplicado la migración 010.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'
import { OUT, ROOT, rng } from './lib.mjs'
import { loadProgram } from './retrieval.mjs'

const APPLY = process.argv.includes('--apply')
const NAME = 'Piloto 19 celdas — modalidad B (conjunto S)'
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const pilot = JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8'))
const pack = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8'))
const byId = Object.fromEntries(pack.S.map((c) => [c.cellId, c]))
const manualRaw = fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.md'), 'utf8')
const manualVersion = (manualRaw.match(/Versión \*\*([^*]+)\*\*/) ?? [])[1] ?? 'desconocida'
// Para la persona se omite la sección «Salida» (formato JSON para los modelos); el resto del manual es el mismo que recibieron las IA.
const manualText = manualRaw.replace(/## Salida[\s\S]*?(?=## Importante)/, '')

const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts'))
const progByName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p])); const progCache = {}
/** Contexto adicional (bajo petición): párrafos de las páginas contiguas (±1) a las mostradas que aún no estén en los pasajes. Se calcula aquí y se guarda SIN partido. */
function extraContext(party, passages, cap = 30) {
  const prog = (progCache[party] ??= loadProgram(progByName[party]))
  const shownPages = new Set(passages.map((p) => p.page).filter((p) => Number.isInteger(p))); const want = new Set()
  for (const p of shownPages) { want.add(p - 1); want.add(p); want.add(p + 1) }
  const shownText = passages.map((p) => p.text)
  const out = []
  for (const para of prog.paras) {
    if (!want.has(para.page)) continue
    if (shownText.some((t) => t.includes(para.text) || para.text.includes(t))) continue
    out.push({ page: para.page, text: para.text }); if (out.length >= cap) break
  }
  return out
}
const ids = pilot.cells.map((c) => c.cellId)
const missing = ids.filter((i) => !byId[i]); if (missing.length) throw new Error(`Celdas ausentes en el paquete: ${missing.join(', ')}`)
// Orden aleatorio fijo (semilla 2911) para que el orden de presentación no delate la prioridad ni el motivo de selección.
const r = rng(2911); const order = ids.map((id) => [r(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
const cells = order.map((id, n) => {
  const c = byId[id]; const [questionId, entityId] = id.split('|')
  const snapshot = { item: c.item, context: c.context, language: c.language, passages: c.passagesB.map((p) => ({ page: p.page ?? null, text: p.text })) }
  return { ord: n + 1, id, questionId, entityId, party: c.party, blind: `Partido ${String.fromCharCode(65 + (n % 26))}`, snapshot, extra: extraContext(c.party, snapshot.passages) }
})
console.log(`Campaña «${NAME}»: ${cells.length} celdas; manual ${manualVersion}; orden aleatorio (semilla 2911); contexto adicional por celda: ${cells.map((x) => x.extra.length).join(',')}.`)
if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply para crearla.'); process.exit(0) }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const c = await pool.connect()
try {
  await c.query('BEGIN')
  if ((await c.query('SELECT 1 FROM eval_campaigns WHERE name = $1', [NAME])).rowCount) throw new Error('La campaña ya existe')
  const creds = (await c.query('SELECT id FROM admin_credentials')).rows
  const ev = (await c.query(
    `INSERT INTO eval_evaluators (label, affiliation, credential_id) VALUES ('Humano interno 1', 'internal', $1)
     ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label RETURNING id`, [creds.length === 1 ? creds[0].id : null])).rows[0]
  const camp = (await c.query(
    `INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note)
     VALUES ($1,'pilot','open',$2,$3,$4,$5) RETURNING id`,
    [NAME, manualVersion, manualText,
      'Muestra DIRIGIDA de 19 celdas del conjunto S de la modalidad B: 10 prioritarias de adjudicación, 3 posibles omisiones de posición y las que cumplen la regla pre-registrada a posteriori (con solapes). Criterios fijados antes de ver las evaluaciones humanas; no se modifican.',
      'No es una muestra aleatoria ni representativa: sobrerrepresenta casos conflictivos o informativos. Sus métricas no se extrapolan al banco. Quien evalúa es el diseñador del sistema (humano INTERNO, no referencia independiente) y conoce parte de los resultados: la ceguera es parcial.'])).rows[0]
  for (const x of cells) {
    const cell = (await c.query(
      `INSERT INTO eval_cells (campaign_id, ord, question_id, entity_id, blind_label, party_name, extra_context) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [camp.id, x.ord, x.questionId, x.entityId, x.blind, x.party, JSON.stringify(x.extra)])).rows[0]
    await c.query('INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ($1,1,$2,$3,$4)',
      [cell.id, JSON.stringify(x.snapshot), sha(JSON.stringify(x.snapshot)), 'instantánea inicial (pasajes recuperados por la configuración B congelada)'])
    await c.query('INSERT INTO eval_assignments (cell_id, evaluator_id) VALUES ($1,$2)', [cell.id, ev.id])
  }
  await c.query('INSERT INTO eval_audit (evaluator_id, action, campaign_id, detail) VALUES ($1,$2,$3,$4)', [ev.id, 'campaign_created', camp.id, JSON.stringify({ cells: cells.length })])
  await c.query('COMMIT')
  console.log(`Campaña creada: ${camp.id}`)
} catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release(); await pool.end() }
