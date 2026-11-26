// Análisis LOCAL de la campaña de recodificación con el manual v0.2-borrador (8 celdas): evaluación de la persona (v0.2) frente a la del piloto (v0.1, agente), a la adjudicación vigente
// (agente) y a las IA de la modalidad B. No llama a modelos ni escribe en la BD. LIMITACIONES: n = 8 (no evaluable como métrica), muestra dirigida, procedencia declarada y no verificada
// de forma independiente, hubo apoyo posterior de un agente según la declaración. Sirve para ver SI LAS REGLAS v0.2 RESUELVEN los desacuerdos de manual, no para estimar fiabilidad.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { OUT, ROOT } from './lib.mjs'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`
  SELECT p.ord AS pord, n.ord AS nord, pc.document_class AS v1_cls, pc.intensity AS v1_int, pc.insufficient_context AS v1_ins,
         nc.document_class AS v2_cls, nc.intensity AS v2_int, nc.insufficient_context AS v2_ins, nc.rationale AS v2_rat, nc.evidence AS v2_ev,
         a.document_class AS adj_cls, a.intensity AS adj_int, a.revision AS adj_rev, a.causes AS adj_causes,
         p.question_id||'|'||p.entity_id AS id
    FROM eval_cells n
    JOIN eval_campaigns kn ON kn.id = n.campaign_id AND kn.kind = 'main'
    JOIN eval_cells p ON p.question_id = n.question_id AND p.entity_id = n.entity_id JOIN eval_campaigns kp ON kp.id = p.campaign_id AND kp.kind = 'pilot'
    JOIN position_codings nc ON nc.campaign_id = n.campaign_id AND nc.question_id = n.question_id AND nc.entity_id = n.entity_id AND nc.evaluator_kind = 'human'
    JOIN position_codings pc ON pc.campaign_id = p.campaign_id AND pc.question_id = p.question_id AND pc.entity_id = p.entity_id AND pc.evaluator_kind = 'human'
    LEFT JOIN eval_adjudications a ON a.cell_id = p.id AND a.revision = (SELECT max(revision) FROM eval_adjudications y WHERE y.cell_id = p.id)
   ORDER BY p.ord`)
await pool.end()
const recs = fs.readFileSync(path.join(OUT, 'benchmark_S_B.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens) && r.modality === 'B')
const first = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!first[k] || r.repeat < first[k].repeat) first[k] = r }
const FULL = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_B_informe.json'), 'utf8')).evaluadoresCompletos
const S = (c, i, ins) => (ins && !c ? 'contexto insuficiente' : c ? `${c}${i != null ? (i > 0 ? ' +' : ' ') + i : ''}` : '—')
const TARGET = new Set([6, 7, 12, 15, 3])
const out = rows.map((r) => ({ celda: r.pord, tipo: TARGET.has(r.pord) ? 'manual' : 'control', v02_persona: S(r.v2_cls, r.v2_int, r.v2_ins), piloto_v01_agente: S(r.v1_cls, r.v1_int, r.v1_ins), adjudicacion_agente: S(r.adj_cls, r.adj_int), ia: FULL.map((L) => S(first[r.id + '|' + L]?.document_class, first[r.id + '|' + L]?.intensity)).join(' / '), rationale: r.v2_rat }))
const same = (a, b) => a === b
const stats = { n: out.length, v02_igual_adjudicacion: out.filter((x) => same(x.v02_persona, x.adjudicacion_agente)).length, v02_igual_piloto: out.filter((x) => same(x.v02_persona, x.piloto_v01_agente)).length,
  manual_n: out.filter((x) => x.tipo === 'manual').length, manual_v02_igual_adjudicacion: out.filter((x) => x.tipo === 'manual' && same(x.v02_persona, x.adjudicacion_agente)).length, manual_v02_igual_piloto: out.filter((x) => x.tipo === 'manual' && same(x.v02_persona, x.piloto_v01_agente)).length,
  claseIgualAdjudicacion: out.filter((x) => x.v02_persona.split(' ')[0] === x.adjudicacion_agente.split(' ')[0]).length }
let md = `# Recodificación v0.2 (borrador) — 8 celdas (LOCAL)\n\nProcedencia: declarada por la persona (con apoyo posterior de un agente); no verificada de forma independiente. n = 8: **no evaluable como métrica**; sirve para ver si las reglas v0.2 resuelven los desacuerdos de manual.\n\n| Celda | Tipo | Persona (v0.2) | Piloto v0.1 (agente) | Adjudicación vigente (agente) | IA completas (llama / minimax / codex) |\n|---|---|---|---|---|---|\n` + out.map((x) => `| ${x.celda} | ${x.tipo} | ${x.v02_persona} | ${x.piloto_v01_agente} | ${x.adjudicacion_agente} | ${x.ia} |`).join('\n') + `\n\n${JSON.stringify(stats)}\n`
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/INFORME_recodificacion_v02.md'), md); fs.writeFileSync(path.join(OUT, 'recodificacion_v02.json'), JSON.stringify({ stats, out }, null, 1))
console.log(md)
console.log('\n--- justificaciones de la persona (celdas del manual) ---'); for (const x of out.filter((x) => x.tipo === 'manual')) console.log(`celda ${x.celda}: ${x.rationale}`)
