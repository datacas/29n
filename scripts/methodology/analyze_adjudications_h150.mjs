// Análisis LOCAL de las adjudicaciones (en sombra) de la campaña de 150: causas, acciones propuestas y estimación con el diseño de cuántas posiciones omitidas se CONFIRMARON.
// Las adjudicaciones las produjo una IA (consta en cada justificación y en eval_authorship): son «adjudicadas por IA, sin verificación humana». Solo lectura; no llama a modelos.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { ROOT } from './lib.mjs'
import { stratifiedProportion } from './sampling.mjs'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`
  SELECT c.ord, d.sample, d.tier, d.stratum_size AS "N", d.stratum_sampled AS n, i.reasons, i.priority,
         p.document_class AS ev_cls, p.intensity AS ev_int, a.document_class AS adj_cls, a.intensity AS adj_int, a.causes, a.proposed_action AS action, (a.id IS NOT NULL) AS adjudicada,
         (d.tier IN ('R-sin_fila')) AS en_sin_fila
    FROM eval_cells c JOIN eval_campaigns k ON k.id = c.campaign_id AND k.name LIKE 'Campaña humana%' JOIN eval_sample_design d ON d.cell_id = c.id
    JOIN position_codings p ON p.campaign_id = c.campaign_id AND p.question_id = c.question_id AND p.entity_id = c.entity_id
    LEFT JOIN eval_adjudication_items i ON i.cell_id = c.id
    LEFT JOIN eval_adjudications a ON a.cell_id = c.id AND a.revision = (SELECT max(revision) FROM eval_adjudications y WHERE y.cell_id = c.id)`); await pool.end()
const adj = rows.filter((r) => r.adjudicada); const POS = ['supports', 'opposes', 'explicit_neutral']
const cnt = (arr, f) => arr.reduce((m, x) => { for (const k of [].concat(f(x))) m[k] = (m[k] ?? 0) + 1; return m }, {})
const out = { adjudicadas: adj.length, porGrupo: cnt(adj, (x) => x.reasons[0].split(' (')[0].slice(0, 60)), causas: cnt(adj, (x) => x.causes), acciones: cnt(adj, (x) => x.action ?? 'sin acción'), claseFinal: cnt(adj, (x) => x.adj_cls ?? 'sin resolver') }
out.cambioDeClaseTrasAdjudicar = adj.filter((x) => x.adj_cls !== x.ev_cls).length
// Estimación con el diseño: celdas sin posición (R, N=591): proporción con posición CONFIRMADA por la adjudicación (clase final = adjudicada si la hay, si no la evaluación)
const RN = rows.filter((r) => r.tier === 'R-sin_fila'); const finalCls = (r) => (r.adjudicada ? r.adj_cls : r.ev_cls); const N = RN[0]?.N ?? 591
const est = (f) => { const e = stratifiedProportion([{ N, n: RN.length, x: RN.filter(f).length }]); return { p: +e.p.toFixed(3), estimadas: Math.round(N * e.p), ic95: [Math.round(N * e.lo), Math.round(N * e.hi)] } }
out.omisionesConfirmadasPorIA = { marco: N, n: RN.length, propuestasPorLaEvaluacion: est((r) => POS.includes(r.ev_cls)), confirmadasTrasAdjudicar: est((r) => POS.includes(finalCls(r))), seOpone: est((r) => finalCls(r) === 'opposes'), apoya: est((r) => finalCls(r) === 'supports'), nota: 'Marco = celdas sin posición de las preguntas de desarrollo; adjudicadas por IA; no extrapola a E ni a todo el banco.' }
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/out/adjudicaciones_h150.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1))
