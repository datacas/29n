/**
 * Crea las posiciones (partido × pregunta) de preguntas NUEVAS a partir del escaneo.
 *
 *   node scripts/spike12/seed_positions.ts plan  --questions Q024,...,Q033 [--min 0.5] [--sentence-min 0.7]
 *   node scripts/spike12/seed_positions.ts apply
 *
 * plan:  por cada pregunta y partido, toma los párrafos del escaneo con p >= --min (máx. 2), los trocea en
 *        frases, deja las que Jev marca como relevantes, descarta frases rotas y verifica que sean literales del PDF.
 *        Guarda docs/spike12/seed_plan.json y seed_preview.md. NO escribe en la base de datos.
 * apply: inserta las posiciones del plan. Con citas → 'needs_review' (las revisa y aprueba una persona);
 *        sin citas → 'draft' + 'not_stated'. No pisa posiciones existentes y registra la auditoría.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assessClaim } from '../../app/lib/jev/claim-relevance.ts'
import { JevClient } from '../../app/lib/jev/client.ts'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import { arg, dbPool, loadPageTexts, OUT_DIR, PARTY_NAMES, requireKeyOrExplain, ROOT } from './common.ts'
import { mapLimit } from './runner.ts'
import { isJustification, withProposal } from './justification.ts'
import { join as joinPath } from 'node:path'

const mode = process.argv[2]
const planName = (process.argv.includes('--plan-file') ? process.argv[process.argv.indexOf('--plan-file') + 1] : 'seed_plan') as string
const planPath = join(OUT_DIR, `${planName}.json`)
const pool = dbPool()
const PARTY_FILES = new Map<string, string>((JSON.parse(readFileSync(join(ROOT, 'docs', 'programas', 'parties.json'), 'utf8')) as Array<{ name: string; file: string }>).map((p) => [p.name, p.file]))

interface SeedItem {
  question_id: string
  party: string
  claims: Array<{ literal_text: string; source_page: number; p_paragraph: number; p_sentence: number; quote_check: string }>
}

const usable = (t: string) =>
  t.length >= 40 && /^[A-ZÁÉÍÓÚÑÀÈÒÇ¿¡«"“]/.test(t.trim()) && !/[:]$/.test(t.trim()) && !/^[•·\-–]/.test(t.trim()) && !/\b\d{2,3}\s+[a-záéíóúñ]/.test(t)

try {
  if (mode === 'plan') {
    requireKeyOrExplain()
    let qids = (arg('questions', '') as string).split(',').map((x) => x.trim()).filter(Boolean)
    if (!qids.length) {
      const all = await pool.query(`SELECT pilot_question_id AS id FROM questions WHERE pilot_question_id IS NOT NULL AND pilot_question_id <> 'Q021' ORDER BY 1`)
      qids = all.rows.map((r) => r.id)
    }
    const PARTIES = (arg('parties', '') as string).split(',').map((x) => x.trim()).filter(Boolean)
    if (!PARTIES.length) PARTIES.push(...PARTY_NAMES)
    const min = Number(arg('min', '0.5'))
    const sMin = Number(arg('sentence-min', '0.7'))
    const { rows } = await pool.query(`SELECT pilot_question_id AS id, canonical_text AS text FROM questions WHERE pilot_question_id = ANY($1)`, [qids])
    const qText = new Map<string, string>(rows.map((r) => [r.id, r.text]))
    const client = new JevClient()
    const plan: SeedItem[] = []
    let calls = 0

    for (const party of PARTIES) {
      const scan = JSON.parse(readFileSync(join(OUT_DIR, 'scan', `${party}.json`), 'utf8')).paragraphs as Array<{ page: number; text: string; scores: Record<string, number> }>
      const pages = loadPageTexts(party)
      for (const qid of qids) {
        const paras = scan.filter((p) => (p.scores[qid] ?? 0) >= min).sort((a, b) => b.scores[qid] - a.scores[qid]).slice(0, 2)
        const claims: SeedItem['claims'] = []
        for (const para of paras) {
          const sentences = para.text.split(/(?<=[.;:!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 25)
          const scored = await mapLimit(sentences, 4, async (s) => {
            calls++
            const a = await assessClaim(client, { questionText: qText.get(qid)!, party, literalText: s, sourcePage: para.page })
            return { s, p: a.pRelevant ?? 0 }
          })
          for (const { s, p } of scored.filter((x) => x.p >= sMin && usable(x.s)).sort((a, b) => b.p - a.p).slice(0, 3)) {
            const check = verifyQuote(s, pages, para.page)
            if (check === 'not_found' || check === 'no_source') continue
            // Fichas «medida + Porque…»: una justificación sola no es una cita válida; se completa con la medida
            let literal = s
            if (isJustification(s)) {
              const file = PARTY_FILES.get(party)
              const full = file ? withProposal(joinPath(ROOT, 'docs', 'programas', file), para.page, s) : null
              if (!full) continue
              literal = full
            }
            claims.push({ literal_text: literal, source_page: para.page, p_paragraph: para.scores[qid], p_sentence: p, quote_check: check })
          }
        }
        plan.push({ question_id: qid, party, claims })
      }
    }
    writeFileSync(planPath, JSON.stringify({ created_at: new Date().toISOString(), min, sentenceMin: sMin, plan }, null, 1))
    const withC = plan.filter((x) => x.claims.length)
    const L = ['# Plan de posiciones para preguntas nuevas', '', `${withC.length} de ${plan.length} posiciones con citas (${withC.reduce((a, x) => a + x.claims.length, 0)} citas). **Nada aplicado.**`, '']
    for (const qid of qids) {
      L.push(`## ${qid} — ${qText.get(qid)}`, '')
      for (const x of plan.filter((p) => p.question_id === qid)) {
        L.push(`### ${x.party} — ${x.claims.length ? `${x.claims.length} citas` : 'sin evidencia'}`)
        for (const c of x.claims) L.push(`- pág. ${c.source_page} · p=${c.p_sentence.toFixed(2)} · «${c.literal_text}»`)
        L.push('')
      }
    }
    writeFileSync(join(OUT_DIR, `${planName}_preview.md`), L.join('\n'))
    console.log(`Plan: ${withC.length}/${plan.length} posiciones con citas, ${withC.reduce((a, x) => a + x.claims.length, 0)} citas (${calls} llamadas a Jev)`)
    const grid: Record<string, string> = {}
    for (const qid of qids) grid[qid] = PARTIES.map((pt) => `${pt}:${plan.find((x) => x.question_id === qid && x.party === pt)!.claims.length}`).join(' ')
    console.table(grid)
  } else if (mode === 'apply') {
    const { plan } = JSON.parse(readFileSync(planPath, 'utf8')) as { plan: SeedItem[] }
    const client = await pool.connect()
    let withC = 0, without = 0, skipped = 0
    try {
      await client.query('BEGIN')
      for (const x of plan) {
        const { rows } = await client.query(
          `SELECT q.id AS qid, e.id AS eid FROM questions q, entities e WHERE q.pilot_question_id = $1 AND e.name = $2 AND e.type = 'party'`, [x.question_id, x.party])
        if (!rows.length) { console.log(`SALTADA ${x.question_id} ${x.party}: pregunta o partido no encontrados`); skipped++; continue }
        const evidence = x.claims.map((c) => ({
          stance: 'unclear', conditions: 'Sin analizar (evidencia del escaneo; revisar)', source_page: c.source_page,
          literal_text: c.literal_text, affected_area: '', review_status: 'draft', normalized_text: '', source: 'jev-scan'
        }))
        const has = evidence.length > 0
        const ins = await client.query(
          `INSERT INTO positions (entity_id, question_id, review_status, stance_status, evidence_jsonb)
           VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (entity_id, question_id) DO NOTHING RETURNING id`,
          [rows[0].eid, rows[0].qid, has ? 'needs_review' : 'draft', has ? 'unknown' : 'not_stated', JSON.stringify(has ? evidence : [])])
        if (!ins.rows.length) { skipped++; continue }
        has ? withC++ : without++
        await client.query(
          `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
           VALUES ('jev-spike', 'seed_position', 'position', $1, $2, $3::jsonb)`,
          [ins.rows[0].id, `Posición creada ${x.question_id} × ${x.party}`, JSON.stringify({ claims: x.claims.length })])
      }
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
    console.log(`Aplicado: ${withC} posiciones con citas ('needs_review'), ${without} sin evidencia ('draft'/'not_stated'), omitidas ${skipped}.`)
  } else {
    console.error('Uso: seed_positions.ts plan|apply')
    process.exit(1)
  }
} finally {
  await pool.end()
}
