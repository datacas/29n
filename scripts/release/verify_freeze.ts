/**
 * Comprueba que un release en borrador está CONGELADO: el hash del manifiesto cuadra y editar posiciones o
 * preguntas (dentro de una transacción que se revierte) no cambia lo que serviría el endpoint público.
 *
 *   node scripts/release/verify_freeze.ts [--version 1.0.0-rc1]
 */
import pg from 'pg'
import { createHash } from 'node:crypto'
import { buildReleasePayload, loadReleaseContent } from '../../app/lib/release/content.ts'
import { checkContent, checkSignDiscrepancies } from './publication_blocks.ts'
const canonical = (v: any): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v)
const pool = new pg.Pool({ connectionString: 'postgresql://app:password@localhost:5433/affinity' })
const c = await pool.connect()
try {
  const { rows: [r] } = await c.query(`SELECT sr.id, sr.manifest_jsonb, sr.manifest_hash, sr.scoring_model_version, sr.version, c.slug AS consultation_slug, c.title AS consultation_title, c.description AS consultation_description, c.metadata AS consultation_metadata FROM survey_releases sr JOIN consultations c ON c.id=sr.consultation_id WHERE sr.version=$1`, [process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : '1.0.0-rc1'])
  const h = createHash('sha256').update(canonical(r.manifest_jsonb)).digest('hex')
  console.log('hash guardado = hash recalculado del manifiesto:', h === r.manifest_hash)
  const q = (s: string, p?: unknown[]) => c.query(s, p)
  // Bloqueos de publicación (#53) sobre el contenido CONGELADO del release: citas verificables en el PDF, respaldo documental, discrepancias de signo sin adjudicar e ítems sin atomicidad/dirección.
  {
    const content = r.manifest_jsonb.content; const names = Object.fromEntries(content.entities.map((e: any) => [e.entityId, e.name]))
    const { rows: qrows } = await q(`SELECT id, pilot_question_id AS code FROM questions WHERE id = ANY($1)`, [content.questions.map((x: any) => x.questionId)])
    const a1 = checkContent(qrows, content.positions.map((p: any) => ({ party: names[p.entityId], questionId: p.questionId, value: p.value, evidence: (p.evidence ?? []).map((e: any) => ({ text: e.text, page: e.page })) })))
    const a2 = await checkSignDiscrepancies(q, qrows)
    const blocks = [...a1.blocks, ...a2.blocks]
    console.log('bloqueos de publicación:', blocks.length)
    for (const b of blocks.slice(0, 30)) console.log('  - BLOQUEO ·', b)
    for (const w of [...a1.warnings, ...a2.warnings]) console.log('  Aviso:', w)
    if (blocks.length) process.exitCode = 2
  }
  await c.query('BEGIN')
  const before = await buildReleasePayload(q as any, r.id, r)
  await q(`UPDATE positions SET value = -2 WHERE id = (SELECT p.id FROM positions p JOIN release_questions rq ON rq.question_id=p.question_id WHERE rq.release_id=$1 AND p.review_status='approved' AND p.value=2 LIMIT 1)`, [r.id])
  await q(`UPDATE questions SET canonical_text = 'TEXTO CAMBIADO' WHERE id = (SELECT question_id FROM release_questions WHERE release_id=$1 LIMIT 1)`, [r.id])
  const after = await buildReleasePayload(q as any, r.id, r)
  const live = await loadReleaseContent(q as any, r.id)
  const dist = (p: any) => JSON.stringify(p.positions.reduce((a: any, x: any) => (a[x.value] = (a[x.value] ?? 0) + 1, a), {}))
  console.log('payload congelado sigue igual tras editar datos:', JSON.stringify(before) === JSON.stringify(after), '| frozen =', after.frozen)
  console.log('lectura en vivo sí cambiaría → valores', dist(live), 'vs congelado', dist(after), '| texto cambiado en vivo:', live.questions.some((x: any) => x.canonicalText === 'TEXTO CAMBIADO'), '| en congelado:', after.questions.some((x: any) => x.canonicalText === 'TEXTO CAMBIADO'))
  await c.query('ROLLBACK')
} finally { c.release(); await pool.end() }
