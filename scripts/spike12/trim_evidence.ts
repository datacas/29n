/**
 * Recorta positions.evidence_jsonb a las citas que Jev marcó como relevantes (jev_claim_relevance).
 * DECISIÓN HUMANA: solo se ejecuta con --apply. Sin --apply muestra lo que haría (dry-run).
 *
 *   node scripts/spike12/trim_evidence.ts --questions Q022 --status needs_review [--min 0.75] [--apply]
 *
 * Antes de tocar nada copia las citas originales a positions_evidence_backup.
 * No cambia review_status ni aprueba nada. Comprueba por sha1 que la cita no cambió desde el análisis.
 */
import { createHash } from 'node:crypto'
import { arg, dbPool, flag } from './common.ts'

const questions = (arg('questions', 'Q022') as string).split(',').map((s) => s.trim())
const status = arg('status', 'needs_review') as string
const min = Number(arg('min', '0.75'))
const apply = flag('apply')

const pool = dbPool()
const client = await pool.connect()
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS positions_evidence_backup (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      evidence_jsonb jsonb NOT NULL,
      reason text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`)

  const { rows } = await client.query(
    `SELECT p.id, e.name AS party, q.pilot_question_id AS qid, p.evidence_jsonb, p.review_status
       FROM positions p JOIN entities e ON e.id = p.entity_id JOIN questions q ON q.id = p.question_id
      WHERE q.pilot_question_id = ANY($1) AND p.review_status = $2 AND p.evidence_jsonb IS NOT NULL
      ORDER BY 3, 2`,
    [questions, status]
  )

  await client.query('BEGIN')
  for (const r of rows) {
    const ev = r.evidence_jsonb as any[]
    // Última ejecución del filtro para esta posición
    const { rows: rel } = await client.query(
      `SELECT claim_index, claim_sha1, p_relevant FROM jev_claim_relevance
        WHERE position_id = $1 AND run_id = (SELECT run_id FROM jev_claim_relevance WHERE position_id = $1 ORDER BY created_at DESC LIMIT 1)`,
      [r.id]
    )
    if (rel.length !== ev.length) {
      console.log(`${r.qid} ${r.party}: SALTADA (hay ${ev.length} citas y ${rel.length} análisis; vuelve a ejecutar claim_relevance.ts)`)
      continue
    }
    const keepIdx = new Set<number>()
    for (const x of rel) {
      const sha = createHash('sha1').update(ev[x.claim_index]?.literal_text ?? '').digest('hex')
      if (sha !== x.claim_sha1) throw new Error(`${r.qid} ${r.party}: la cita ${x.claim_index} cambió desde el análisis`)
      if (x.p_relevant !== null && Number(x.p_relevant) >= min) keepIdx.add(x.claim_index)
    }
    if (keepIdx.size === 0) {
      console.log(`${r.qid} ${r.party}: SALTADA (ninguna cita llega a ${min}; no se deja la posición sin evidencia)`)
      continue
    }
    const kept = ev.filter((_, i) => keepIdx.has(i))
    console.log(`${r.qid} ${r.party}: ${ev.length} → ${kept.length} citas`)
    for (const c of kept) console.log(`    pág. ${c.source_page}: «${String(c.literal_text).slice(0, 110)}»`)
    if (apply) {
      await client.query(`INSERT INTO positions_evidence_backup (position_id, evidence_jsonb, reason) VALUES ($1,$2,$3)`, [
        r.id, JSON.stringify(ev), `recorte a citas relevantes (Jev p>=${min})`
      ])
      await client.query(`UPDATE positions SET evidence_jsonb = $2 WHERE id = $1`, [r.id, JSON.stringify(kept)])
    }
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK')
  console.log(apply ? '\nAplicado (con copia en positions_evidence_backup).' : '\nDry-run: no se ha cambiado nada. Añade --apply para aplicar.')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
  await pool.end()
}
