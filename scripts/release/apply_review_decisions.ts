/**
 * Aplica las decisiones de revisión editorial de las 54 posiciones en needs_review.
 *
 *   node scripts/release/apply_review_decisions.ts                 # dry-run
 *   node scripts/release/apply_review_decisions.ts --apply         # escribe
 *   node scripts/release/apply_review_decisions.ts --only Adelante Andalucía
 *
 * Decisiones: docs/review_54_decisions.json
 * - approve  → review_status='approved', value, stance_status, conditions
 * - exclude  → review_status='approved', value=NULL, stance_status de exclusión
 * - reject   → review_status='rejected', value=NULL
 *
 * Nunca toca posiciones que no estén en needs_review (salvo --force).
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const apply = process.argv.includes('--apply')
const force = process.argv.includes('--force')
const only = arg('only')
const file = arg('file', 'docs/review_54_decisions.json') as string
const data = JSON.parse(readFileSync(file, 'utf8'))
const decisions: any[] = data.decisions.filter((d: any) => !only || d.party === only)

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity',
  max: 2
})
const client = await pool.connect()
const q = (sql: string, params?: unknown[]) => client.query(sql, params)

const counts: Record<string, number> = {}
const problems: string[] = []

try {
  await q('BEGIN')

  for (const d of decisions) {
    const { rows } = await q(
      `SELECT p.id, p.review_status, p.value, p.stance_status, p.evidence_jsonb, p.review_note
         FROM positions p
         JOIN questions q ON q.id = p.question_id
         JOIN entities e ON e.id = p.entity_id
        WHERE q.pilot_question_id = $1 AND e.name = $2`,
      [d.qid, d.party]
    )
    if (rows.length === 0) {
      problems.push(`${d.party} ${d.qid}: no encontrada`)
      continue
    }
    const pos = rows[0]
    if (pos.review_status !== 'needs_review' && !force) {
      problems.push(`${d.party} ${d.qid}: estado actual ${pos.review_status}, se omite (usa --force para forzar)`)
      continue
    }

    let evidence: any[] = Array.isArray(pos.evidence_jsonb) ? pos.evidence_jsonb : []
    if (Array.isArray(d.evidence_keep_indices)) {
      evidence = d.evidence_keep_indices.map((i: number) => evidence[i]).filter(Boolean)
    }
    if (d.evidence_replace) {
      const i = d.evidence_replace.index ?? 0
      if (!evidence[i]) {
        problems.push(`${d.party} ${d.qid}: no existe la cita índice ${i}`)
        continue
      }
      evidence = evidence.map((e, idx) => idx === i
        ? {
            ...e,
            literal_text: d.evidence_replace.literal_text,
            source_page: d.evidence_replace.source_page,
            translation_es: d.evidence_replace.translation_es ?? e.translation_es ?? null,
            review_status: d.action === 'reject' ? 'rejected' : 'approved'
          }
        : e)
    }

    let reviewStatus: string
    let value: number | null = null
    let stance: string
    let conditions: string | null = null
    let reason = d.reason || null

    if (d.action === 'approve') {
      reviewStatus = 'approved'
      value = d.value
      stance = d.stance || 'approved'
      conditions = stance === 'conditional' ? (d.conditions || null) : null
      if (stance === 'conditional' && !conditions) {
        problems.push(`${d.party} ${d.qid}: condicional sin condición`)
        continue
      }
    } else if (d.action === 'exclude') {
      reviewStatus = 'approved'
      value = null
      stance = d.stance || 'ambiguous'
      if (!['ambiguous', 'not_comparable', 'conflicting_sources'].includes(stance)) {
        problems.push(`${d.party} ${d.qid}: estado de exclusión no válido ${stance}`)
        continue
      }
    } else if (d.action === 'reject') {
      reviewStatus = 'rejected'
      value = null
      stance = 'unknown'
    } else {
      problems.push(`${d.party} ${d.qid}: acción desconocida ${d.action}`)
      continue
    }

    // Mantener coherente el estado de cada cita con el de la posición.
    evidence = evidence.map((e) => ({ ...e, review_status: reviewStatus }))

    await q(
      `UPDATE positions
          SET review_status = $2,
              value = $3,
              stance_status = $4,
              conditions = $5,
              review_note = $6,
              not_comparable_reason = $7,
              evidence_jsonb = $8::jsonb,
              reviewed_by = 'revision-asistida',
              reviewed_at = NOW()
        WHERE id = $1`,
      [
        pos.id,
        reviewStatus,
        value,
        stance,
        conditions,
        reason,
        stance === 'not_comparable' ? reason : null,
        JSON.stringify(evidence)
      ]
    )

    await q(
      `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
       VALUES ('revision-asistida', $1, 'position', $2, $3, $4::jsonb)`,
      [
        d.action,
        pos.id,
        `Revisión asistida ${d.qid} × ${d.party}: ${d.action}${value !== null ? ` (${value})` : ''}`,
        JSON.stringify({ ...d, before: { review_status: pos.review_status, value: pos.value, stance_status: pos.stance_status } })
      ]
    )

    counts[d.action] = (counts[d.action] || 0) + 1
    console.log(`${d.action.padEnd(8)} ${d.party.padEnd(20)} ${d.qid} ${value === null ? stance : value}`)
  }

  const { rows: after } = await q(
    `SELECT p.review_status, count(*) n
       FROM positions p JOIN questions q ON q.id = p.question_id
      WHERE q.pilot_question_id IS NOT NULL
      GROUP BY 1 ORDER BY 1`
  )

  console.log('\nResumen:', counts)
  console.log('Estado global:', Object.fromEntries(after.map((r) => [r.review_status, Number(r.n)])))
  if (problems.length) {
    console.log(`\nAvisos (${problems.length}):`)
    for (const p of problems) console.log('  -', p)
  }

  if (apply) {
    await q('COMMIT')
    console.log('\nAplicado (COMMIT).')
  } else {
    await q('ROLLBACK')
    console.log('\nDry-run (ROLLBACK). Añade --apply para escribir.')
  }
  if (problems.length && !force) process.exitCode = 2
} catch (e) {
  await q('ROLLBACK')
  console.error('Error, rollback:', e)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
