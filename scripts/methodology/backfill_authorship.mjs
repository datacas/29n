// Anota (solo añadir) la AUTORÍA MATERIAL de los registros ya existentes, separándola de quien autoriza. Idempotente.
// - Piloto (19 evaluaciones y sus adjudicaciones): las produjo un AGENTE DE IA operando la cuenta «Humano interno 1» (D26); autoriza/responde la persona responsable.
// - Recodificación v0.2 de 8 celdas: la persona declara que las leyó y decidió ella, con apoyo posterior de un agente.
// - Revisión 2 de la celda 12: registrada por el agente bajo autorización expresa de la persona responsable (2026-11-26).
//   node scripts/methodology/backfill_authorship.mjs --apply
import pg from 'pg'
const APPLY = process.argv.includes('--apply')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
const plan = []
const { rows: codings } = await c.query(`SELECT pc.id, k.kind FROM position_codings pc JOIN eval_campaigns k ON k.id = pc.campaign_id WHERE pc.evaluator_kind = 'human'`)
for (const r of codings) plan.push(r.kind === 'pilot'
  ? ['position_codings', r.id, 'ai_agent', 'agente de IA operando la cuenta «Humano interno 1»', 'persona responsable (comunicado; D26)', 'Evaluación ciega del piloto producida por un agente de IA; no es una evaluación humana personal.']
  : ['position_codings', r.id, 'human_with_agent_support', '«Humano interno 1» (persona)', 'persona responsable', 'Declaración de la persona (2026-11-25): las leyó y decidió ella, sin que nadie ni ninguna IA le preparara clase ni justificación, con apoyo posterior de un agente.'])
const { rows: adjs } = await c.query(`SELECT a.id, a.revision, ce.ord FROM eval_adjudications a JOIN eval_cells ce ON ce.id = a.cell_id`)
for (const r of adjs) plan.push(['eval_adjudications', r.id, 'ai_agent', 'agente de IA operando la cuenta «Humano interno 1»', 'persona responsable (mensajes pegados; autoría de los mensajes no verificada, D26)',
  r.ord === 12 && r.revision === 2 ? 'Revisión registrada por el agente por AUTORIZACIÓN EXPRESA de la persona responsable (2026-11-26), al aprobar la regla 2 del manual v0.2.' : 'Adjudicación del piloto producida por un agente de IA; no es una decisión humana verificada.'])
let n = 0
try {
  await c.query('BEGIN')
  for (const [t, id, kind, label, by, note] of plan) {
    const has = (await c.query('SELECT 1 FROM eval_authorship WHERE record_table = $1 AND record_id = $2 AND author_kind <> $3', [t, id, 'unverified'])).rowCount; if (has) continue
    if (APPLY) await c.query('INSERT INTO eval_authorship (record_table, record_id, author_kind, author_label, authorized_by, note) VALUES ($1,$2,$3,$4,$5,$6)', [t, id, kind, label, by, note]); n++
  }
  await c.query(APPLY ? 'COMMIT' : 'ROLLBACK'); console.log(`${APPLY ? 'Anotadas' : 'Anotaría'} ${n} autorías (de ${plan.length} registros).`)
} catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release(); await pool.end() }
