/**
 * Completa las citas que son solo una justificación («Porque…») con la medida que la precede en el PDF.
 * Las posiciones afectadas vuelven a «needs_review» (conservan su valor) para que una persona las revise de nuevo.
 *
 *   node scripts/spike12/fix_justifications.ts [--party "Adelante Andalucía"] [--apply]
 *
 * Sin --apply no escribe nada: solo imprime antes y después. Con --apply guarda copia de la evidencia anterior
 * en positions_evidence_backup y registra la auditoría.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import { arg, dbPool, flag, loadPageTexts, ROOT } from './common.ts'
import { isJustification, withProposal } from './justification.ts'

const apply = flag('apply')
const only = arg('party', '') as string
const PARTY_LIST = JSON.parse(readFileSync(join(ROOT, 'docs', 'programas', 'parties.json'), 'utf8')) as Array<{ name: string; file: string }>
const pdfOf = (party: string) => {
  const f = PARTY_LIST.find((p) => p.name === party)?.file
  return f ? join(ROOT, 'docs', 'programas', f) : null
}
const pool = dbPool()
const client = await pool.connect()
let changed = 0, kept = 0, failed = 0
try {
  await client.query('BEGIN')
  const { rows } = await client.query(
    `SELECT p.id, p.review_status, e.name AS party, q.pilot_question_id AS qid, p.evidence_jsonb AS ev
       FROM positions p JOIN entities e ON e.id = p.entity_id JOIN questions q ON q.id = p.question_id
      WHERE NOT e.is_historical AND p.evidence_jsonb IS NOT NULL AND jsonb_array_length(p.evidence_jsonb) > 0
        AND ($1 = '' OR e.name = $1) AND p.review_status IN ('approved','needs_review')
      ORDER BY e.name, q.pilot_question_id`, [only])
  for (const r of rows) {
    const pdf = pdfOf(r.party)
    if (!pdf) continue
    const ev = r.ev as Array<Record<string, any>>
    let touched = false
    const next = ev.map((c) => {
      const t: string = c.literal_text ?? ''
      if (!isJustification(t) || t.includes('[…]')) return c
      const full = withProposal(pdf, c.source_page, t)
      if (!full) { failed++; console.log(`SIN MEDIDA ${r.qid} ${r.party} p.${c.source_page}: ${t.slice(0, 70)}`); return c }
      const check = verifyQuote(full, loadPageTexts(r.party), c.source_page)
      if (check === 'not_found' || check === 'no_source') { failed++; console.log(`NO VERIFICA ${r.qid} ${r.party} p.${c.source_page}: ${full.slice(0, 90)}`); return c }
      touched = true
      console.log(`${r.qid} ${r.party} p.${c.source_page} [${check}]\n   ANTES:   ${t.slice(0, 100)}\n   DESPUÉS: ${full.slice(0, 260)}`)
      return { ...c, literal_text: full }
    })
    if (!touched) { kept++; continue }
    changed++
    if (apply) {
      await client.query(`INSERT INTO positions_evidence_backup (position_id, evidence_jsonb, reason) VALUES ($1, $2::jsonb, $3)`,
        [r.id, JSON.stringify(ev), 'Cita solo de justificación («Porque…»): se añade la medida que la precede'])
      await client.query(`UPDATE positions SET evidence_jsonb = $2::jsonb, review_status = 'needs_review', reviewed_by = NULL, reviewed_at = NULL WHERE id = $1`, [r.id, JSON.stringify(next)])
      await client.query(
        `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
         VALUES ('jev-spike', 'complete_justification', 'position', $1, $2, $3::jsonb)`,
        [r.id, `Cita completada con la medida ${r.qid} × ${r.party}`, JSON.stringify({ from_status: r.review_status })])
    }
  }
  console.log(`\nPosiciones a corregir: ${changed} · sin cambios: ${kept} · citas no resueltas: ${failed}`)
  await client.query(apply ? 'COMMIT' : 'ROLLBACK')
  console.log(apply ? 'APLICADO' : 'Simulación (sin --apply): nada escrito')
} catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release(); await pool.end() }
