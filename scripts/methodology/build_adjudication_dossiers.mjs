// Construye en la BD LOCAL la cola de adjudicación del piloto y el expediente (dossier) de cada celda: referencia provisional y cita registrada, respuestas de cada IA,
// tu evaluación, discrepancias detectadas, comprobación de recuperación y texto de las páginas relevantes del programa original. No llama a modelos ni toca positions.
//   node scripts/methodology/build_adjudication_dossiers.mjs            # simulación: muestra la cola
//   node scripts/methodology/build_adjudication_dossiers.mjs --apply    # escribe/actualiza eval_adjudication_items (el expediente se puede reconstruir; las adjudicaciones no se tocan)
// Alcance (decidido por el responsable): celdas con discrepancia entre el humano interno y los 3 evaluadores de IA completos, posibles posiciones omitidas
// (sin posición registrada pero con posición según el humano), diferencias de intensidad con la referencia (mismo signo, distinta intensidad) y posiciones registradas
// que el humano no encuentra en los pasajes (patrón de la celda 16; añadido por el responsable). Sin duplicados.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { OUT, ROOT, loadRelease } from './lib.mjs'
import { loadProgram, quoteHit } from './retrieval.mjs'

const APPLY = process.argv.includes('--apply')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const prog = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const pilot = JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8')).cells; const motivos = Object.fromEntries(pilot.map((c) => [c.cellId, c.motivos]))
const FULL = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_B_informe.json'), 'utf8')).evaluadoresCompletos
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const recs = fs.readFileSync(path.join(OUT, 'benchmark_S_B.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens))
const A = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!A[k] || r.repeat < A[k].repeat) A[k] = r }
const labels = [...new Set(recs.map((r) => r.evaluator_label))].sort()
const pack = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8')); const byId = Object.fromEntries(pack.S.map((c) => [c.cellId, c]))
const sign = (c) => (c === 'supports' ? 1 : c === 'opposes' ? -1 : 0)
const refInfo = (id) => { const p = pm.get(id); if (!p || p.value == null) return { present: false }
  return { present: true, value: p.value, stanceStatus: p.stanceStatus, claimPage: p.claimPage ?? null, claimText: p.claimText ?? null, conditions: p.conditions ?? null, evidence: (p.evidence ?? []).map((e) => ({ page: e.page ?? null, text: e.text })) } }

const { rows: camp } = await pool.query(`SELECT id FROM eval_campaigns WHERE kind = 'pilot' ORDER BY created_at LIMIT 1`)
const { rows: hum } = await pool.query(
  `SELECT pc.id AS coding_id, pc.question_id, pc.entity_id, pc.document_class, pc.intensity, pc.insufficient_context, pc.rationale, pc.evidence, ce.id AS cell_id, ce.ord, ce.blind_label, ce.party_name
     FROM position_codings pc JOIN eval_cells ce ON ce.campaign_id = pc.campaign_id AND ce.question_id = pc.question_id AND ce.entity_id = pc.entity_id
    WHERE pc.campaign_id = $1 AND pc.evaluator_kind = 'human' ORDER BY ce.ord`, [camp[0].id])

const programCache = {}
const queue = []
for (const h of hum) {
  const id = `${h.question_id}|${h.entity_id}`; const ref = refInfo(id); const ai = Object.fromEntries(labels.map((L) => [L, A[id + '|' + L] ?? null]))
  const reasons = []; const disc = []
  const hc = h.document_class
  const fullClasses = FULL.map((L) => ai[L]?.document_class).filter(Boolean)
  if (h.insufficient_context && !hc) reasons.push('discrepancia: contexto insuficiente según el humano')
  else if (fullClasses.some((c) => c !== hc)) { reasons.push('discrepancia entre el humano y los evaluadores de IA completos'); disc.push(`Clase distinta: humano ${hc}; IA: ${FULL.map((L) => `${L}=${ai[L]?.document_class ?? '—'}`).join(', ')}`) }
  const signs = new Set([hc, ...fullClasses].filter((c) => c === 'supports' || c === 'opposes')); if (signs.size > 1) disc.push('DISCREPANCIA DE SIGNO (apoya vs se opone) entre evaluadores')
  if (!ref.present && hc && hc !== 'not_mentioned') { reasons.push('posible posición omitida (sin posición registrada; el humano encuentra una)'); disc.push(`Sin posición registrada; humano: ${hc} ${h.intensity ?? ''}`) }
  if (ref.present && hc && sign(hc) !== 0 && sign(hc) === Math.sign(ref.value) && Math.abs(ref.value) !== Math.abs(h.intensity)) { reasons.push('diferencia de intensidad con la referencia (mismo signo)'); disc.push(`Intensidad: humano ${h.intensity}; referencia ${ref.value}`) }
  if (ref.present && hc && sign(hc) !== Math.sign(ref.value) && (hc === 'supports' || hc === 'opposes')) disc.push('Signo distinto respecto de la referencia provisional')
  if (ref.present && hc === 'not_mentioned') { if (!reasons.length || !reasons.some((r) => r.startsWith('posición registrada'))) reasons.push('posición registrada que el humano no encuentra en los pasajes (sin respaldo aparente)') }
  if (ref.present && hc === 'not_mentioned') disc.push(`La referencia registra una posición (${ref.value}, ${ref.stanceStatus}); el humano no la encuentra en los pasajes dados`)
  if (!reasons.length) continue

  const c = byId[id]; const P = (programCache[c.party] ??= loadProgram(prog[c.party])); const passages = c.passagesB
  const regPages = [...new Set([ref.claimPage, ...(ref.evidence ?? []).map((e) => e.page)].filter((x) => Number.isInteger(x)))]
  const retrievalCheck = {
    registeredPages: regPages, retrievedPages: [...new Set(passages.map((p) => p.page))].sort((a, b) => a - b),
    registeredPageInRetrieved: regPages.length ? regPages.some((p) => passages.some((q) => q.page === p)) : null,
    registeredQuoteFoundInRetrieved: ref.present && ref.evidence?.length ? ref.evidence.some((e) => passages.some((q) => quoteHit({ page: q.page, text: q.text }, e.text, e.page))) : null
  }
  if (ref.present && retrievalCheck.registeredQuoteFoundInRetrieved === false) disc.push('La cita registrada NO aparece en los pasajes recuperados (posible error de recuperación)')
  const pageWhy = new Map(); const addPage = (p, why) => { if (Number.isInteger(p) && p >= 1 && p <= P.pages.length) { const k = p; pageWhy.set(k, [...(pageWhy.get(k) ?? []), why]) } }
  for (const p of regPages) { addPage(p - 1, 'contigua a la cita registrada'); addPage(p, 'cita registrada'); addPage(p + 1, 'contigua a la cita registrada') }
  for (const e of h.evidence ?? []) { addPage(e.page - 1, 'contigua a tu evidencia'); addPage(e.page, 'evidencia que seleccionaste'); addPage(e.page + 1, 'contigua a tu evidencia') }
  for (const L of labels) if (ai[L]?.page) addPage(ai[L].page, `cita de ${L}`)
  const docPages = [...pageWhy.entries()].sort((a, b) => a[0] - b[0]).slice(0, 18).map(([page, why]) => ({ page, why: [...new Set(why)], text: String(P.pages[page - 1] ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 7000) }))
  const dossier = {
    ord: h.ord, blindLabel: h.blind_label, party: c.party, language: c.language, pdf: { file: prog[c.party].file, url: `/programas/${prog[c.party].file}`, pages: P.pages.length },
    item: c.item, context: c.context, selectionReasons: motivos[id] ?? [],
    mine: { codingId: h.coding_id, documentClass: hc, intensity: h.intensity, insufficientContext: h.insufficient_context, rationale: h.rationale, evidence: h.evidence },
    reference: ref, ai: labels.map((L) => ({ evaluator: L, complete: FULL.includes(L), ...(ai[L] ? { documentClass: ai[L].document_class, intensity: ai[L].intensity, quote: ai[L].quote, page: ai[L].page, rationale: ai[L].rationale, quoteVerified: ai[L].quote_verified ?? null, model: ai[L].model_actual } : { documentClass: null }) })),
    discrepancies: disc, retrievalCheck, retrievedPassages: passages.map((p) => ({ page: p.page, text: p.text })), docPages
  }
  queue.push({ cellId: h.cell_id, ord: h.ord, reasons, dossier })
}
// Prioridad indicada por el responsable: 16, 12, 6, 15, 3, 19, 7, 10 (resto, por orden de celda)
const PRIO = [16, 12, 6, 15, 3, 19, 7, 10, 2]   // la celda 2 se añadió después (mismo patrón que la 16), al final de la cola
queue.sort((a, b) => { const pa = PRIO.indexOf(a.ord), pb = PRIO.indexOf(b.ord); return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.ord - b.ord })
console.log(`Cola: ${queue.length} celdas →`, queue.map((q, i) => `${i + 1}. celda ${q.ord} [${q.reasons.map((r) => r.split(' ')[0]).join('/')}]`).join('; '))
if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); await pool.end(); process.exit(0) }
const c = await pool.connect()
try {
  await c.query('BEGIN')
  for (const [i, q] of queue.entries()) {
    await c.query(`INSERT INTO eval_adjudication_items (cell_id, priority, reasons, dossier) VALUES ($1,$2,$3,$4)
                   ON CONFLICT (cell_id) DO UPDATE SET priority = EXCLUDED.priority, reasons = EXCLUDED.reasons, dossier = EXCLUDED.dossier, built_at = now()`, [q.cellId, i + 1, q.reasons, JSON.stringify(q.dossier)])
  }
  await c.query('COMMIT'); console.log('Cola y expedientes escritos en eval_adjudication_items.')
} catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release(); await pool.end() }
