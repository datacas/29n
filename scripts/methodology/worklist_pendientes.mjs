// Genera docs/methodology/local/PENDIENTES.md (local, no se publica): las adjudicaciones sobre preguntas divididas y las 7 preguntas señaladas sin dividir.
import pg from 'pg'; import fs from 'node:fs'
const AUD = JSON.parse(fs.readFileSync('docs/methodology/local/out/auditoria_items.json', 'utf8')).items; const qidOf = (n) => AUD.find((x) => x.n === n).questionId
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
// OJO: las claves de KEEP son el nº de orden `n` de la auditoría de ítems (auditoria_items.json), NO el identificador Qnnn.
const KEEP = { 17: 'el segundo elemento (modelos propios) forma parte de la misma infraestructura de IA', 28: 'requiere acotar «sectores estratégicos» sin inventar una lista', 61: 'una sola medida (embargo de armas); falta decidir la absolutez de «toda»', 72: 'regulación y trámites son un mismo objeto', 77: 'sin dirección: no se puede fijar sin inventar una', 104: 'sin dirección y tres impuestos', 146: 'regional con un solo partido' }
const num = (p) => Number(String(p).replace(/\D/g, ''))
let md = '# Pendientes de preguntas (local, no se publica)\n\nGenerado ' + new Date().toISOString().slice(0, 10) + '.\n\n'
// 1) adjudicaciones sobre preguntas divididas
const { rows: adj } = await c.query(`
  SELECT DISTINCT ON (a.cell_id) a.proposed_action AS action, a.document_class AS cls, a.intensity AS int, a.evidence, a.rationale, pc.evidence AS ev2, q.id AS qid, q.pilot_question_id AS pq, q.canonical_text AS qtext, e.id AS eid, e.name AS party
    FROM eval_adjudications a LEFT JOIN position_codings pc ON pc.id = a.own_coding_id JOIN eval_cells ce ON ce.id = a.cell_id JOIN questions q ON q.id = ce.question_id JOIN entities e ON e.id = ce.entity_id
   WHERE a.proposed_action IN ('add_position','correct_registered','remove_registered')
     AND EXISTS (SELECT 1 FROM questions h WHERE h.pilot_question_id = q.pilot_question_id || 'a' AND h.status = 'draft')
   ORDER BY a.cell_id, a.revision DESC`)
md += `## A. Adjudicaciones sobre preguntas ya divididas (${adj.length})\nLa pregunta original ya no está en la 2.2.0. Para cada una: decide en cuál de sus mitades vale la propuesta (o en ninguna).\n\n`
for (const r of adj.sort((x, y) => num(x.pq) - num(y.pq))) {
  const { rows: hs } = await c.query(`SELECT h.pilot_question_id AS pq, h.canonical_text AS text, (SELECT p.value FROM positions p WHERE p.question_id = h.id AND p.entity_id = $2 AND p.review_status = 'approved') AS val FROM questions h WHERE h.pilot_question_id ~ ('^' || $1 || '[a-z]$') ORDER BY 1`, [r.pq, r.eid])
  const { rows: [orig] } = await c.query(`SELECT value, review_status FROM positions WHERE question_id = $1 AND entity_id = $2`, [r.qid, r.eid])
  const ev = (r.evidence?.length ? r.evidence : r.ev2 ?? []).map((x) => `> «${String(x.text).slice(0, 380)}» (p. ${x.page ?? '?'})`).join('\n')
  md += `### ${r.pq} · ${r.party} — propuesta: **${r.action}** ${r.cls ?? ''} ${r.int ?? ''}\nOriginal: «${r.qtext}» (posición actual en la original: ${orig ? `${orig.review_status}/${orig.value ?? '-'}` : 'ninguna'})\nMitades en la 2.2.0:\n${hs.map((h) => `- **${h.pq}** ${h.text} → posición actual de ${r.party}: ${h.val ?? 'sin posición'}`).join('\n')}\nEvidencia:\n${ev || '> (sin cita)'}\nJustificación: ${String(r.rationale ?? '').slice(0, 300)}\n\n`
}
// 2) 7 señaladas
md += '## B. Preguntas señaladas y NO divididas (7)\n'
for (const [n, why] of Object.entries(KEEP)) {
  const { rows: [q] } = await c.query(`SELECT q.id, q.pilot_question_id AS pq, q.canonical_text AS text, q.context_text FROM questions q WHERE q.id = $1`, [qidOf(Number(n))])
  if (!q) { md += `### Q${n}: no encontrada\n`; continue }
  const { rows: pos } = await c.query(`SELECT e.name, p.value FROM positions p JOIN entities e ON e.id = p.entity_id WHERE p.question_id = $1 AND p.review_status = 'approved' AND p.value IS NOT NULL ORDER BY e.name`, [q.id])
  md += `\n### ${q.pq} — ${q.text}\nContexto: ${q.context_text}\nPor qué está señalada: ${why}\nPosiciones aprobadas (${pos.length}): ${pos.map((p) => `${p.name} ${p.value}`).join(' · ')}\nDecisión: [ ] dejar como está  [ ] reescribir a: ____________  [ ] dividir en: ____________\n`
}
fs.writeFileSync('docs/methodology/local/PENDIENTES.md', md); console.log('adjudicaciones', adj.length, '· ficheros bytes', md.length)
c.release(); await pool.end()
