/**
 * Auditoría de neutralidad de un release.
 *
 * Comprueba que el cuestionario no dé ventaja por construcción a ninguna formación:
 *  - ninguna pregunta debe puntuar a un solo partido (no compara, solo mueve una media);
 *  - ninguna pregunta debe quedarse sin posiciones de casi todos los partidos;
 *  - el reparto de preguntas regionales no debe comerse el cuestionario;
 *  - el texto no debe contener términos cargados.
 *
 * Uso:
 *   node --experimental-strip-types scripts/audit/fairness.ts [--version 2.0.4] [--json]
 *
 * Sin --version usa el release publicado más reciente. Sale con código 1 si hay avisos graves.
 */
import pg from 'pg'
import { selectQuestions } from '../../app/lib/survey/select-questions.ts'

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const asJson = process.argv.includes('--json')
// Términos que orientan la respuesta. No es una lista exhaustiva: es una red de seguridad.
const LOADED_TERMS: Array<[RegExp, string]> = [
  [/masificad/i, '«masificado»'],
  [/descontrolad/i, '«descontrolado»'],
  [/ley mordaza/i, '«ley mordaza» (apodo de sus críticos)'],
  [/gran(es)? fortuna/i, '«grandes fortunas»'],
  [/hist[oó]rica (infrafinanciaci|deuda)/i, 'presupone una injusticia histórica'],
  [/lo mismo por habitante/i, '«lo mismo por habitante» como premisa'],
  [/especulaci/i, '«especulación»'],
  [/ascensor social/i, '«ascensor social»'],
  [/sin reducci[oó]n salarial/i, 'doble condición (jornada + salario)']
]

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity',
  max: 2
})

interface Question {
  questionId: string
  canonicalText: string
  dimensionCode?: string
  themeCode?: string
  regionalParties?: string[]
}
interface Position { entityId: string; questionId: string; value: number | null; stanceStatus?: string }
interface Entity { entityId: string; name: string }

const { rows } = await pool.query(
  arg('version')
    ? `SELECT version, manifest_jsonb->'content' AS content FROM survey_releases WHERE version = $1 AND manifest_jsonb->'content' IS NOT NULL LIMIT 1`
    : `SELECT version, manifest_jsonb->'content' AS content FROM survey_releases
        WHERE status = 'published' AND manifest_jsonb->'content' IS NOT NULL
        ORDER BY published_at DESC NULLS LAST LIMIT 1`,
  arg('version') ? [arg('version')] : []
)
if (!rows.length) {
  console.error('No hay release con contenido congelado para auditar.')
  await pool.end()
  process.exit(2)
}
const version = rows[0].version
const content = rows[0].content as { questions: Question[]; positions: Position[]; entities: Entity[] }

const questions = content.questions ?? []
const positions = (content.positions ?? []).filter((p) => p.value !== null)
const entities = content.entities ?? []
const nameOf = new Map(entities.map((e) => [e.entityId, e.name]))

const INCLUDED = new Set(['approved', 'conditional', 'explicit_neutral'])
const byQuestion = new Map<string, Position[]>()
for (const p of positions) {
  if (p.stanceStatus && !INCLUDED.has(p.stanceStatus)) continue
  if (!byQuestion.has(p.questionId)) byQuestion.set(p.questionId, [])
  byQuestion.get(p.questionId)!.push(p)
}

// --- 1. Preguntas exclusivas o casi exclusivas ---
const solo = questions.filter((q) => (byQuestion.get(q.questionId)?.length ?? 0) === 1)
const sparse = questions.filter((q) => {
  const n = byQuestion.get(q.questionId)?.length ?? 0
  return n > 1 && n <= 3
})

// --- 2. Posiciones por partido ---
const perParty = entities
  .map((e) => {
    const vals = positions.filter((p) => p.entityId === e.entityId).map((p) => p.value as number)
    const strong = vals.filter((v) => Math.abs(v) === 2).length
    return {
      name: e.name,
      positions: vals.length,
      mean: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null,
      strongShare: vals.length ? Math.round((strong / vals.length) * 100) : 0
    }
  })
  .sort((a, b) => b.positions - a.positions)

// --- 3. Reparto del cuestionario que ve cada persona (todos los partidos) ---
const all = entities.map((e) => e.entityId)
const selection = (['quick', 'normal', 'deep'] as const).map((mode) => {
  const picked = selectQuestions(questions, positions, entities, all, mode)
  const regional = picked.filter((q) => (q.regionalParties?.length ?? 0) > 0).length
  const oneParty = picked.filter((q) => (byQuestion.get(q.questionId)?.length ?? 0) === 1).length
  return { mode, questions: picked.length, regional, oneParty }
})

// --- 4. Términos cargados ---
const wording = questions
  .map((q) => {
    const hits = LOADED_TERMS.filter(([re]) => re.test(q.canonicalText)).map(([, label]) => label)
    return hits.length ? { question: q.canonicalText, hits } : null
  })
  .filter(Boolean)

const findings = {
  version,
  questions: questions.length,
  positions: positions.length,
  entities: entities.length,
  soloQuestions: solo.map((q) => q.canonicalText),
  sparseQuestions: sparse.map((q) => ({ text: q.canonicalText, parties: byQuestion.get(q.questionId)!.length })),
  selection,
  wording,
  perParty
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2))
} else {
  console.log(`Auditoría de neutralidad · release ${version}`)
  console.log(`Preguntas: ${findings.questions} · posiciones: ${findings.positions} · partidos: ${findings.entities}\n`)

  console.log('Posiciones por partido (cobertura y fuerza):')
  for (const p of perParty) {
    console.log(`  ${p.name.padEnd(22)} ${String(p.positions).padStart(3)} posiciones · media ${p.mean ?? '—'} · ±2 en el ${p.strongShare}%`)
  }

  console.log('\nCuestionario que recibe quien selecciona a todos:')
  for (const s of selection) {
    console.log(`  ${s.mode.padEnd(6)} ${s.questions} preguntas · regionales ${s.regional} · de un solo partido ${s.oneParty}`)
  }

  console.log(`\nPreguntas que solo puntúan a un partido (${solo.length}):`)
  for (const q of findings.soloQuestions) {
    const qq = questions.find((x) => x.canonicalText === q)!
    const name = nameOf.get(byQuestion.get(qq.questionId)![0].entityId)
    console.log(`  [${name}] ${q}`)
  }

  console.log(`\nPreguntas con solo 2-3 partidos (${sparse.length}):`);
  for (const s of findings.sparseQuestions) console.log(`  (${s.parties}) ${s.text}`)

  console.log(`\nTérminos cargados (${wording.length}):`)
  for (const w of wording) console.log(`  ${w!.hits.join(', ')} → ${w!.question}`)
}

await pool.end()
process.exitCode = solo.length ? 1 : 0
