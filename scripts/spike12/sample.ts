/**
 * Paso 2-3: selecciona 30 posiciones estratificadas y genera la plantilla de referencia humana.
 *
 *   node scripts/spike12/sample.ts [--size 30] [--seed 12]
 *
 * Escribe docs/spike12/benchmark_sample.json. Los campos `human` están vacíos a propósito:
 * la verdad de referencia la pone una persona. Las etiquetas de Claude se guardan aparte
 * (`claude_proposal`) solo para comparar, nunca como referencia.
 * Si el fichero ya existe se conserva lo que haya etiquetado (no se sobrescribe).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { claudePositionClass } from '../../app/lib/jev/review.ts'
import { stratifiedSample } from '../../app/lib/jev/sample.ts'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import { arg, dbPool, loadPageTexts, loadPendingPositions, OUT_DIR } from './common.ts'

const size = Number(arg('size', '30'))
const seed = Number(arg('seed', '12'))
const target = join(OUT_DIR, 'benchmark_sample.json')

if (existsSync(target)) {
  console.error(`Ya existe ${target}. Para regenerarlo, bórralo a mano (perderías las etiquetas humanas).`)
  process.exit(1)
}

const pool = dbPool()
try {
  const all = await loadPendingPositions(pool)
  const sample = stratifiedSample(all, { size, seed })
  mkdirSync(OUT_DIR, { recursive: true })

  const items = sample.map(({ position: p, stratum }) => ({
    position_id: p.positionId,
    question_id: p.questionId,
    party: p.party,
    stratum,
    question: p.questionText,
    claims: p.claims.map((c) => ({
      literal_text: c.literalText,
      page: c.sourcePage,
      conditions: c.conditions,
      quote_check: verifyQuote(c.literalText, loadPageTexts(p.party), c.sourcePage)
    })),
    claude_proposal: { stance_class: claudePositionClass(p), stance_status: p.proposedStanceStatus },
    // A RELLENAR POR UNA PERSONA. stance: supports | opposes | conditional | unclear | contradictory
    human: { stance: null, evidence_sufficient: null, annotator: null, notes: '' }
  }))

  writeFileSync(
    target,
    JSON.stringify({ spike: 'SPIKE-12', seed, created_at: new Date().toISOString(), size: items.length, items }, null, 2)
  )

  const byStratum: Record<string, number> = {}
  const byParty: Record<string, number> = {}
  for (const s of sample) {
    byStratum[s.stratum] = (byStratum[s.stratum] ?? 0) + 1
    byParty[s.position.party] = (byParty[s.position.party] ?? 0) + 1
  }
  console.log(`Muestra de ${items.length}/${all.length} posiciones → ${target}`)
  console.log('Por estrato:', byStratum)
  console.log('Por partido:', byParty)
  console.log('Siguiente paso: una persona rellena `human.stance` (y `annotator`) en cada item.')
} finally {
  await pool.end()
}
