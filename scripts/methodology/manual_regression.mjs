// Casos de regresión permanentes del manual (LOCAL): comprueba que la adjudicación vigente de cada caso (y la recodificación con v0.2 de la persona, si existe) coincide con lo esperado.
// Sale con código 1 si alguna decisión cambia: un cambio de resultado es un CAMBIO DE CRITERIO y exige justificación y evaluación de impacto. No llama a modelos ni escribe en la BD.
//   node scripts/methodology/manual_regression.mjs
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { ROOT } from './lib.mjs'
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/methodology/local/casos_regresion_manual.json'), 'utf8'))
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`
  SELECT p.ord, a.document_class AS adj_cls, a.intensity AS adj_int, a.revision AS adj_rev, a.manual_version AS adj_manual, nc.document_class AS rec_cls, nc.intensity AS rec_int
    FROM eval_cells p JOIN eval_campaigns kp ON kp.id = p.campaign_id AND kp.kind = 'pilot'
    LEFT JOIN eval_adjudications a ON a.cell_id = p.id AND a.revision = (SELECT max(revision) FROM eval_adjudications y WHERE y.cell_id = p.id)
    LEFT JOIN LATERAL (SELECT pc.document_class, pc.intensity FROM position_codings pc JOIN eval_campaigns kn ON kn.id = pc.campaign_id AND kn.kind = 'main'
        WHERE pc.question_id = p.question_id AND pc.entity_id = p.entity_id AND pc.evaluator_kind = 'human' ORDER BY pc.created_at DESC LIMIT 1) nc ON true`); await pool.end()
const by = Object.fromEntries(rows.map((r) => [r.ord, r])); let fails = 0
for (const c of reg.casos) {
  const r = by[c.ord]; const ok = (cls, i) => cls === c.esperado.class && (i ?? null) === c.esperado.intensity
  const adj = r ? ok(r.adj_cls, r.adj_int) : false; const rec = r?.rec_cls ? ok(r.rec_cls, r.rec_int) : null
  const pass = adj && rec !== false; if (!pass) fails++
  console.log(`${pass ? 'OK   ' : 'FALLA'} celda ${String(c.ord).padStart(2)} · esperado ${c.esperado.class}${c.esperado.intensity != null ? ' ' + c.esperado.intensity : ''} · adjudicación ${r?.adj_cls ?? '—'}${r?.adj_int != null ? ' ' + r.adj_int : ''} (rev. ${r?.adj_rev ?? '—'}, manual ${r?.adj_manual ?? '—'}) · recodificación v0.2 ${r?.rec_cls ? r.rec_cls + (r.rec_int != null ? ' ' + r.rec_int : '') : 'n/a'} · regla ${c.regla}${c.tipo ? ' · ' + c.tipo : ''}`)
}
console.log(fails ? `\n${fails} caso(s) con cambio de criterio` : '\nTodos los casos de regresión coinciden.'); process.exitCode = fails ? 1 : 0
