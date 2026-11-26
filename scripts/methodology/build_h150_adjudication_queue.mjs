// Construye en la BD LOCAL la cola de adjudicación (en sombra) de la campaña humana de 150 y el expediente de cada celda. No llama a modelos; no toca positions ni el banco.
// Reglas de inclusión (preinscritas en este fichero; por orden de prioridad):
//   1 signo opuesto entre la evaluación humana y la referencia · 2 referencia con posición que el humano no encuentra (registrada sin respaldo aparente) · 3 discordancia de clase entre el humano y alguna IA completa (T2)
//   4 posible omisión en R (sin posición registrada; el humano encuentra una) · 5 posible omisión en T1 · 6 posición registrada «no comparable» con posición humana · 7 diferencia de intensidad (mismo signo) · 8 otra clase distinta de la referencia
// EXCLUIDAS hasta que termine la REPETIBILIDAD: las celdas preinscritas para repetir (repeat_selected): adjudicarlas ahora le mostraría al evaluador la referencia y las IA y sesgaría la repetición.
//   node scripts/methodology/build_h150_adjudication_queue.mjs            # simulación
//   node scripts/methodology/build_h150_adjudication_queue.mjs --apply
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { loadRelease, OUT, ROOT } from './lib.mjs'
import { loadProgram } from './retrieval.mjs'
const APPLY = process.argv.includes('--apply'); const BASE = 100
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows: [camp] } = await pool.query(`SELECT id FROM eval_campaigns WHERE name LIKE 'Campaña humana%' ORDER BY created_at DESC LIMIT 1`)
const { rows } = await pool.query(`
  SELECT c.id AS cell_id, c.ord, c.question_id||'|'||c.entity_id AS id, d.sample, d.tier, d.repeat_selected AS repeat, p.id AS coding_id, p.document_class AS cls, p.intensity AS int, p.insufficient_context AS ins, p.rationale, p.evidence
    FROM eval_cells c JOIN eval_sample_design d ON d.cell_id = c.id
    JOIN position_codings p ON p.campaign_id = c.campaign_id AND p.question_id = c.question_id AND p.entity_id = c.entity_id AND p.evaluator_kind = 'human' WHERE c.campaign_id = $1 ORDER BY c.ord`, [camp.id])
const fin = JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'sample_final.json'), 'utf8')); const F = Object.fromEntries(fin.cells.map((c) => [c.id, c]))
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const prog = Object.fromEntries(PROGRAMS.map((p) => [p.name, p])); const progCache = {}
const recs = fs.readFileSync(path.join(OUT, 'benchmark_S_B.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens) && r.modality === 'B')
const A = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!A[k] || r.repeat < A[k].repeat) A[k] = r }
const labels = [...new Set(recs.map((r) => r.evaluator_label))].sort(); const FULL = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_B_informe.json'), 'utf8')).evaluadoresCompletos
const sign = (c) => (c === 'supports' ? 1 : c === 'opposes' ? -1 : 0); const POS = ['supports', 'opposes', 'explicit_neutral']
const refInfo = (id) => { const p = pm.get(id); if (!p) return { present: false }; if (p.value == null) return { present: true, comparable: false, stanceStatus: p.stanceStatus, evidence: (p.evidence ?? []).map((e) => ({ page: e.page ?? null, text: e.text })) }
  return { present: true, comparable: true, value: p.value, stanceStatus: p.stanceStatus, claimPage: p.claimPage ?? null, claimText: p.claimText ?? null, conditions: p.conditions ?? null, evidence: (p.evidence ?? []).map((e) => ({ page: e.page ?? null, text: e.text })) } }
const queue = []; const held = []
for (const h of rows) {
  const hc = h.ins && !h.cls ? 'contexto_insuficiente' : h.cls; const ref = refInfo(h.id); const f = F[h.id]; const why = []; const disc = []
  const ai = Object.fromEntries(labels.map((L) => [L, A[h.id + '|' + L] ?? null])); const fullCls = FULL.map((L) => ai[L]?.document_class).filter(Boolean)
  let prio = 99
  const mark = (p, text, d) => { prio = Math.min(prio, p); why.push(text); if (d) disc.push(d) }
  if (ref.present && ref.comparable) {
    if (sign(hc) * Math.sign(ref.value) === -1) mark(1, 'signo opuesto entre la evaluación humana y la referencia', `Signo opuesto: humano ${hc} ${h.int ?? ''}; referencia ${ref.value}`)
    else if (!POS.includes(hc)) mark(2, 'posición registrada que el humano no encuentra en los pasajes (sin respaldo aparente)', `La referencia registra una posición (${ref.value}, ${ref.stanceStatus}); el humano: ${hc}`)
    else if (sign(hc) === Math.sign(ref.value) && Math.abs(h.int) !== Math.abs(ref.value)) mark(7, 'diferencia de intensidad con la referencia (mismo signo)', `Intensidad: humano ${h.int}; referencia ${ref.value}`)
    else if (sign(hc) !== Math.sign(ref.value)) mark(8, 'clase distinta de la referencia', `Clase: humano ${hc}; referencia ${ref.value}`)
  } else if (!ref.present && POS.includes(hc)) mark(h.sample === 'R' ? 4 : 5, h.sample === 'R' ? 'posible posición omitida (muestra representativa)' : 'posible posición omitida (candidata dirigida)', `Sin posición registrada; humano: ${hc} ${h.int ?? ''}`)
  else if (ref.present && !ref.comparable && POS.includes(hc)) mark(6, 'posición registrada no comparable; el humano encuentra una posición', `Referencia ${ref.stanceStatus} sin valor comparable; humano: ${hc} ${h.int ?? ''}`)
  if (fullCls.length && fullCls.some((c) => c !== hc)) mark(3, 'discordancia de clase entre el humano y alguna IA completa', `IA: ${FULL.map((L) => `${L}=${ai[L]?.document_class ?? '—'}`).join(', ')}; humano ${hc}`)
  if (!why.length) continue
  if (h.repeat) { held.push({ ord: h.ord, why }); continue }
  const P = (progCache[f.party] ??= loadProgram(prog[f.party])); const passages = f.snapshot.passages
  const regPages = [...new Set([ref.claimPage, ...(ref.evidence ?? []).map((e) => e.page)].filter(Number.isInteger))]
  const retrievalCheck = { registeredPages: regPages, retrievedPages: [...new Set(passages.map((p) => p.page))].sort((a, b) => a - b), registeredQuoteFoundInRetrieved: f.registrada?.citaEnRecuperado ?? null }
  if (retrievalCheck.registeredQuoteFoundInRetrieved === false) disc.push('La cita registrada NO aparece en los pasajes recuperados (posible error de recuperación)')
  const pageWhy = new Map(); const add = (p, w) => { if (Number.isInteger(p) && p >= 1 && p <= P.pages.length) pageWhy.set(p, [...(pageWhy.get(p) ?? []), w]) }
  for (const p of regPages) { add(p - 1, 'contigua a la cita registrada'); add(p, 'cita registrada'); add(p + 1, 'contigua a la cita registrada') }
  for (const e of h.evidence ?? []) { add(e.page - 1, 'contigua a tu evidencia'); add(e.page, 'evidencia que seleccionaste'); add(e.page + 1, 'contigua a tu evidencia') }
  for (const L of labels) if (ai[L]?.page) add(ai[L].page, `cita de ${L}`)
  const docPages = [...pageWhy.entries()].sort((a, b) => a[0] - b[0]).slice(0, 18).map(([page, w]) => ({ page, why: [...new Set(w)], text: String(P.pages[page - 1] ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 7000) }))
  const dossier = { ord: h.ord, blindLabel: null, party: f.party, language: f.language, pdf: { file: prog[f.party].file, url: `/programas/${prog[f.party].file}`, pages: P.pages.length }, item: f.snapshot.item, context: f.snapshot.context, selectionReasons: why,
    mine: { codingId: h.coding_id, documentClass: hc === 'contexto_insuficiente' ? null : hc, intensity: h.int, insufficientContext: !!h.ins, rationale: h.rationale, evidence: h.evidence }, reference: ref,
    ai: labels.filter((L) => ai[L]).map((L) => ({ evaluator: L, complete: FULL.includes(L), documentClass: ai[L].document_class, intensity: ai[L].intensity, quote: ai[L].quote, page: ai[L].page, rationale: ai[L].rationale, quoteVerified: ai[L].quote_verified ?? null, model: ai[L].model_actual })),
    discrepancies: disc, retrievalCheck, retrievedPassages: passages, docPages }
  queue.push({ cellId: h.cell_id, ord: h.ord, prio, why, dossier })
}
queue.sort((a, b) => a.prio - b.prio || a.ord - b.ord)
const byP = {}; for (const q of queue) byP[q.prio] = (byP[q.prio] ?? 0) + 1
console.log(`Cola de la campaña de 150: ${queue.length} celdas. Por prioridad: ${JSON.stringify(byP)}. Retenidas por repetibilidad: ${held.length} (${held.map((x) => x.ord).join(',')}).`)
if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); await pool.end(); process.exit(0) }
const c = await pool.connect()
try {
  await c.query('BEGIN')
  for (const [i, q] of queue.entries()) await c.query(`INSERT INTO eval_adjudication_items (cell_id, priority, reasons, dossier) VALUES ($1,$2,$3,$4) ON CONFLICT (cell_id) DO UPDATE SET priority = EXCLUDED.priority, reasons = EXCLUDED.reasons, dossier = EXCLUDED.dossier, built_at = now()`, [q.cellId, BASE + i + 1, q.why, JSON.stringify(q.dossier)])
  await c.query('COMMIT'); console.log('Cola y expedientes escritos en eval_adjudication_items.')
} catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release(); await pool.end() }
