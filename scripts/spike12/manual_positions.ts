/**
 * Alta manual de posiciones con cita literal verificada contra el PDF (revisión editorial).
 *   node scripts/spike12/manual_positions.ts <fichero.json> [--apply]
 * Fichero: [{ qid, party, value, quotes: [{ page, text, translation_es? }], note? }]
 * Verifica cada cita (verifyQuote), guarda copia de la evidencia anterior, aprueba con el valor dado y registra auditoría.
 */
import { readFileSync } from 'node:fs'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import { dbPool, flag, loadPageTexts } from './common.ts'

const file = process.argv[2]
const apply = flag('apply')
const replace = flag('replace') // permite corregir posiciones ya aprobadas (copia de seguridad de la evidencia anterior)
const items = JSON.parse(readFileSync(file, 'utf8')) as Array<{ qid: string; party: string; value: number; quotes: Array<{ page: number; text: string; translation_es?: string }> }>
const pool = dbPool()
const client = await pool.connect()
let bad = 0
try {
  await client.query('BEGIN')
  for (const it of items) {
    const pages = loadPageTexts(it.party)
    for (const q of it.quotes) {
      const check = verifyQuote(q.text, pages, q.page)
      if (check === 'not_found' || check === 'no_source') { console.log(`CITA NO VERIFICADA ${it.qid} ${it.party} p.${q.page} (${check}): ${q.text.slice(0, 80)}`); bad++ }
    }
    const { rows } = await client.query(
      `SELECT p.id, p.review_status, p.evidence_jsonb FROM positions p JOIN entities e ON e.id=p.entity_id JOIN questions qq ON qq.id=p.question_id
        WHERE qq.pilot_question_id=$1 AND e.name=$2 FOR UPDATE`, [it.qid, it.party])
    if (rows.length !== 1) { console.log(`SIN POSICIÓN ${it.qid} ${it.party}`); bad++; continue }
    const cur = rows[0]
    if (cur.review_status === 'approved' && !replace) { console.log(`YA APROBADA ${it.qid} ${it.party}: se omite`); continue }
    const evidence = it.quotes.map((q) => ({
      stance: 'unclear', conditions: 'Alta manual con cita verificada (revisión editorial)', source_page: q.page, literal_text: q.text,
      affected_area: '', review_status: 'approved', normalized_text: '', source: 'manual-review',
      ...(q.translation_es ? { translation_es: q.translation_es } : {})
    }))
    if (cur.evidence_jsonb && cur.evidence_jsonb.length)
      await client.query(`INSERT INTO positions_evidence_backup (position_id, evidence_jsonb, reason) VALUES ($1,$2,$3)`, [cur.id, JSON.stringify(cur.evidence_jsonb), 'antes de sustituir evidencia (revisión de cobertura)'])
    await client.query(
      `UPDATE positions SET evidence_jsonb=$2, review_status='approved', stance_status='approved', value=$3, reviewed_by='revision-asistida', reviewed_at=NOW(), review_note=NULL WHERE id=$1`,
      [cur.id, JSON.stringify(evidence), it.value])
    for (const [action, desc] of [['recover_evidence', `Evidencia añadida ${it.qid} × ${it.party}`], ['approve', `Aprobada ${it.qid} × ${it.party}`], ['set_value', `Postura asignada: ${it.value}`]]) {
      await client.query(
        `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes) VALUES ('claude-code',$1,'position',$2,$3,$4::jsonb)`,
        [action, cur.id, desc, JSON.stringify({ value: it.value, round: 'cobertura', quotes: it.quotes.length })])
    }
    console.log(`OK ${it.qid} ${it.party} → ${it.value >= 0 ? '+' : ''}${it.value} (${it.quotes.length} cita/s)`)
  }
  if (bad) throw new Error(`${bad} problema(s): no se aplica nada`)
  await client.query(apply ? 'COMMIT' : 'ROLLBACK')
  console.log(apply ? 'Aplicado (COMMIT).' : 'Dry-run (ROLLBACK). Añade --apply.')
} catch (e) {
  await client.query('ROLLBACK'); console.log(String((e as Error).message)); process.exitCode = 1
} finally {
  client.release(); await pool.end()
}
