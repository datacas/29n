/**
 * ¿Cuántas posiciones CONTRARIAS hay realmente en los programas?
 * Toma los párrafos que el escaneo (scan/<partido>.json) marcó como pertinentes para cada pregunta
 * (p >= --min, por defecto 0,7) y le pide a Jev la polaridad de cada uno con la misma pregunta de postura
 * que usa la pantalla de asignación. Solo lectura: escribe docs/spike12/opposition_scan.json.
 *
 *   node scripts/spike12/scan_opposition.ts [--min 0.7] [--exclude Q021]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { JevClient } from '../../app/lib/jev/client.ts'
import { VALUE_QUESTION, parseValueSuggestion } from '../../app/lib/jev/value-suggestion.ts'
import { arg, dbPool, OUT_DIR, PARTY_NAMES, requireKeyOrExplain } from './common.ts'
import { mapLimit } from './runner.ts'

const min = Number(arg('min', '0.7'))
const exclude = (arg('exclude', 'Q021') as string).split(',').map((s) => s.trim())
const onlyQs = (arg('questions', '') as string).split(',').map((s) => s.trim()).filter(Boolean)
const outName = arg('out', 'opposition_scan.json') as string
const PARTIES = PARTY_NAMES
requireKeyOrExplain()

const pool = dbPool()
try {
  const { rows } = await pool.query(`SELECT pilot_question_id AS id, canonical_text AS text FROM questions WHERE pilot_question_id IS NOT NULL`)
  const qText = new Map<string, string>(rows.map((r) => [r.id, r.text]))

  const jobs: Array<{ party: string; qid: string; page: number; text: string; pRel: number }> = []
  for (const party of PARTIES) {
    const paras = JSON.parse(readFileSync(join(OUT_DIR, 'scan', `${party}.json`), 'utf8')).paragraphs as Array<{ page: number; text: string; scores: Record<string, number> }>
    for (const p of paras) {
      for (const [qid, s] of Object.entries(p.scores)) {
        if (s >= min && !exclude.includes(qid) && qText.has(qid) && (!onlyQs.length || onlyQs.includes(qid))) jobs.push({ party, qid, page: p.page, text: p.text, pRel: s })
      }
    }
  }
  console.log(`${jobs.length} pares párrafo-pregunta con p>=${min}`)

  const client = new JevClient()
  let tokens = 0
  const out = await mapLimit(jobs, 6, async (j) => {
    const r = await client.systemOne(
      { proposicion: qText.get(j.qid), partido: j.party, citas: [{ n: 1, cita_literal: j.text, pagina: j.page, condiciones: 'ninguna' }] },
      VALUE_QUESTION
    )
    tokens += r.usage.input_tokens
    const s = parseValueSuggestion(r.answers)
    return { ...j, choice: s.choice, value: s.value, confidence: s.confidence }
  })

  writeFileSync(join(OUT_DIR, outName), JSON.stringify({ min, created_at: new Date().toISOString(), model: client.model, items: out }, null, 1))

  const dist: Record<string, number> = {}
  for (const o of out) dist[o.choice ?? 'sin respuesta'] = (dist[o.choice ?? 'sin respuesta'] ?? 0) + 1
  console.log('Polaridad de los párrafos pertinentes:', dist)

  // Por (partido, pregunta): ¿hay algún párrafo en contra?
  const pairs = new Map<string, typeof out>()
  for (const o of out) pairs.set(`${o.qid}|${o.party}`, [...(pairs.get(`${o.qid}|${o.party}`) ?? []), o])
  const against = [...pairs.entries()].filter(([, v]) => v.some((o) => (o.value ?? 0) < 0 && (o.confidence ?? 0) >= 0.6))
  const byParty: Record<string, number> = {}
  for (const [k] of against) byParty[k.split('|')[1]] = (byParty[k.split('|')[1]] ?? 0) + 1
  console.log(`Pares (pregunta, partido) con algún párrafo EN CONTRA (conf>=0,6): ${against.length} de ${pairs.size}`, byParty)
  console.log(`Coste ~ $${((tokens / 1e6) * 0.042).toFixed(4)}`)
} finally {
  await pool.end()
}
