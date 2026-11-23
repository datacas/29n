/**
 * Filtro de relevancia por cita con Jev (una petición por cita). Solo lectura sobre positions.
 *
 *   node scripts/spike12/claim_relevance.ts [--questions Q021,Q022] [--status needs_review] [--min 0.5]
 *
 * Guarda en jev_claim_relevance y escribe docs/spike12/claim_relevance_report.md.
 */
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assessClaim } from '../../app/lib/jev/claim-relevance.ts'
import { JevClient } from '../../app/lib/jev/client.ts'
import { arg, dbPool, OUT_DIR, requireKeyOrExplain } from './common.ts'
import { mapLimit } from './runner.ts'

const questions = (arg('questions', 'Q021,Q022') as string).split(',').map((s) => s.trim())
const status = arg('status', 'needs_review') as string
const min = Number(arg('min', '0.5'))
requireKeyOrExplain()

const pool = dbPool()
try {
  const { rows } = await pool.query(
    `SELECT p.id, e.name AS party, q.pilot_question_id AS qid, q.canonical_text, p.evidence_jsonb
       FROM positions p
       JOIN entities e ON e.id = p.entity_id
       JOIN questions q ON q.id = p.question_id
      WHERE q.pilot_question_id = ANY($1) AND p.review_status = $2
        AND p.evidence_jsonb IS NOT NULL
      ORDER BY q.pilot_question_id, e.name`,
    [questions, status]
  )
  const client = new JevClient()
  const runId = randomUUID()

  const jobs = rows.flatMap((r) =>
    (r.evidence_jsonb as any[]).map((c, idx) => ({ r, c, idx }))
  )
  console.log(`${rows.length} posiciones, ${jobs.length} citas, modelo ${client.model}`)

  const done = await mapLimit(jobs, 6, async ({ r, c, idx }) => {
    const a = await assessClaim(client, {
      questionText: r.canonical_text,
      party: r.party,
      literalText: c.literal_text ?? '',
      sourcePage: c.source_page ?? null
    })
    await pool.query(
      `INSERT INTO jev_claim_relevance (position_id, run_id, claim_index, claim_sha1, p_relevant, model, input_tokens, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [r.id, runId, idx, createHash('sha1').update(c.literal_text ?? '').digest('hex'), a.pRelevant,
       client.model, a.result.usage.input_tokens, a.result.latencyMs]
    )
    return { r, c, idx, p: a.pRelevant, tokens: a.result.usage.input_tokens }
  })

  const lines = ['# Relevancia por cita (Jev)', '', `Run ${runId} · modelo \`${client.model}\` · umbral ${min}`, '']
  const byPos = new Map<string, typeof done>()
  for (const d of done) byPos.set(d.r.id, [...(byPos.get(d.r.id) ?? []), d])
  for (const items of byPos.values()) {
    const { r } = items[0]
    const keep = items.filter((i) => (i.p ?? 0) >= min).sort((a, b) => (b.p ?? 0) - (a.p ?? 0))
    lines.push(`## ${r.qid} · ${r.party} — ${keep.length} de ${items.length} citas relevantes`, '', `*${r.canonical_text}*`, '')
    for (const i of keep) lines.push(`- p=${(i.p ?? 0).toFixed(2)} · pág. ${i.c.source_page} · «${String(i.c.literal_text).slice(0, 240)}»`)
    if (!keep.length) lines.push('- (ninguna cita responde a la proposición)')
    lines.push('')
  }
  writeFileSync(join(OUT_DIR, 'claim_relevance_report.md'), lines.join('\n'))
  const total = done.length
  const kept = done.filter((d) => (d.p ?? 0) >= min).length
  console.log(`Relevantes (p>=${min}): ${kept}/${total}. Coste ~ $${((done.reduce((a, d) => a + d.tokens, 0) / 1e6) * 0.042).toFixed(5)}`)
  for (const items of byPos.values()) {
    const k = items.filter((i) => (i.p ?? 0) >= min).length
    console.log(`  ${items[0].r.qid} ${items[0].r.party}: ${k}/${items.length}`)
  }
  console.log(`Informe: ${join(OUT_DIR, 'claim_relevance_report.md')}`)
} finally {
  await pool.end()
}
