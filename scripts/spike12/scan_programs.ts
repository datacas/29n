/**
 * Escaneo exhaustivo (recall): cada párrafo de cada programa se evalúa con Jev contra las 23 preguntas
 * a la vez (una petición por párrafo; Jev evalúa todas las preguntas en paralelo sobre el mismo estado).
 * Solo lectura: escribe docs/spike12/scan/<partido>.json. No toca la base de datos.
 *
 *   node scripts/spike12/scan_programs.ts [--parties Vox,Sumar] [--min 0.3]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { JevClient, type QuestionSpec } from '../../app/lib/jev/client.ts'
import { arg, dbPool, OUT_DIR, requireKeyOrExplain, ROOT } from './common.ts'
import { mapLimit } from './runner.ts'

// Partidos y PDF: docs/programas/parties.json
const PARTY_LIST = JSON.parse(readFileSync(join(ROOT, 'docs', 'programas', 'parties.json'), 'utf8')) as Array<{ name: string; file: string }>
const PDFS: Record<string, string> = Object.fromEntries(PARTY_LIST.map((p) => [p.name, join('docs', 'programas', p.file)]))
const parties = (arg('parties', Object.keys(PDFS).join(',')) as string).split(',').map((s) => s.trim())
const keepMin = Number(arg('min', '0.3'))
// --questions Q024,Q025: solo esas preguntas; el resultado se FUSIONA con el escaneo existente
const themesFile = arg('themes', '') as string // docs/taxonomy/themes.json: escanea contra TEMAS en vez de preguntas
const scanDir = arg('out-dir', 'scan') as string
const onlyQs = (arg('questions', '') as string).split(',').map((x) => x.trim()).filter(Boolean)
requireKeyOrExplain()

export function paragraphsOf(pdf: string): Array<{ page: number; text: string }> {
  const raw = execFileSync('pdftotext', [pdf, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8')
  const out: Array<{ page: number; text: string }> = []
  raw.split('\f').forEach((pageText, i) => {
    for (const block of pageText.split(/\n\s*\n/)) {
      const text = block
        .replace(/(\p{L})-\n(\p{L})/gu, '$1$2')
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text.length < 60) continue
      // Bloques largos: se trocean por frases (≤1200 caracteres) en vez de recortarlos
      let cur = ''
      for (const sentence of text.split(/(?<=[.;:!?])\s+/)) {
        if (cur && cur.length + sentence.length > 1200) {
          out.push({ page: i + 1, text: cur })
          cur = ''
        }
        cur = cur ? `${cur} ${sentence}` : sentence
      }
      if (cur.length >= 60) out.push({ page: i + 1, text: cur })
    }
  })
  return out
}

const pool = dbPool()
try {
  const { rows } = await pool.query(
    `SELECT pilot_question_id AS id, canonical_text AS text FROM questions WHERE pilot_question_id IS NOT NULL ORDER BY 1`
  )
  const questions: Record<string, QuestionSpec> = {}
  for (const q of (onlyQs.length ? rows.filter((r) => onlyQs.includes(r.id)) : rows).filter((r) => r.id !== 'Q021')) {
    questions[q.id] = {
      type: 'noul',
      instructions: `El texto se pronuncia directamente sobre esta cuestión (a favor, en contra o con matices), no solo sobre un tema cercano ni con palabras parecidas: «${q.text}»`
    }
  }
  if (themesFile) {
    const themes = JSON.parse(readFileSync(join(ROOT, themesFile), 'utf8')).themes as Array<{ code: string; name: string; description: string }>
    for (const k of Object.keys(questions)) delete questions[k]
    for (const t of themes) {
      questions[t.code] = {
        type: 'noul',
        instructions: `El texto contiene una propuesta, medida o posición concreta (no solo una mención genérica) sobre: ${t.name}, es decir, ${t.description}.`
      }
    }
    console.log(`${themes.length} temas`)
  }
  const client = new JevClient()
  mkdirSync(join(OUT_DIR, scanDir), { recursive: true })

  for (const party of parties) {
    const pdf = join(ROOT, PDFS[party])
    if (!existsSync(pdf)) { console.log(`${party}: sin PDF, se omite`); continue }
    const paras = paragraphsOf(pdf)
    console.log(`${party}: ${paras.length} párrafos × ${rows.length} preguntas`)
    let tokens = 0
    const results = await mapLimit(paras, 6, async (p, idx) => {
      const r = await client.systemOne({ partido: party, texto: p.text }, questions)
      tokens += r.usage.input_tokens
      const scores: Record<string, number> = {}
      for (const [qid, a] of Object.entries(r.answers)) {
        if (a.type === 'noul' && a.noul >= keepMin) scores[qid] = Math.round(a.noul * 1000) / 1000
      }
      return { idx, page: p.page, text: p.text, scores }
    })
    const file = join(OUT_DIR, scanDir, `${party}.json`)
    let paragraphs = results
    if (onlyQs.length && existsSync(file)) {
      // Fusiona las puntuaciones nuevas en el escaneo existente (mismos párrafos, mismo orden)
      const old = JSON.parse(readFileSync(file, 'utf8'))
      if (old.paragraphs.length !== results.length || old.paragraphs.some((o: any, i: number) => o.text !== results[i].text)) {
        throw new Error(`${party}: los párrafos cambiaron; no se puede fusionar (reescanea todo sin --questions)`)
      }
      paragraphs = old.paragraphs.map((o: any, i: number) => ({ ...o, scores: { ...o.scores, ...results[i].scores } }))
    }
    writeFileSync(file, JSON.stringify({ party, model: client.model, created_at: new Date().toISOString(), keepMin, paragraphs }, null, 1))
    const hits = results.reduce((a, r) => a + Object.values(r.scores).filter((s) => s >= 0.5).length, 0)
    console.log(`  hecho: ${hits} coincidencias p>=0.5 · tokens ${tokens} · ~$${((tokens / 1e6) * 0.042).toFixed(4)}`)
  }
} finally {
  await pool.end()
}
