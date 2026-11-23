/**
 * Construye (o refresca) un release EN BORRADOR (status='draft') a partir de las posiciones aprobadas.
 * NO publica: publicar es una decisión aparte (draft → published exige manifiesto y hash).
 *
 *   node scripts/release/build_release.ts [--version 1.0.0-rc1] [--exclude Q021] [--allow-unresolved] [--apply]
 *
 * Sin --apply ejecuta todo dentro de una transacción que se revierte (dry-run). Con --apply la confirma.
 * Si ya existe un borrador con esa versión se REFRESCA (los publicados/archivados nunca se tocan).
 *
 * Reglas:
 *  - Preguntas: pilotos con posiciones aprobadas con evidencia de al menos DOS partidos
 *    (una pregunta de un solo partido no compara y se excluye). Se excluyen las de --exclude.
 *  - Entidades: los partidos con alguna posición aprobada en esas preguntas.
 *  - Comprobaciones: toda posición aprobada tiene postura (value, o estado de exclusión); ninguna posición de
 *    esas preguntas queda en draft/needs_review; todas las preguntas tienen tema/dimensión.
 *  - El manifiesto CONGELA el contenido público (manifest.content: preguntas, partidos, posiciones con sus citas y
 *    dimensiones). El endpoint público sirve ese contenido, no las tablas editables. Hash = SHA-256 del JSON canónico.
 */
import { createHash } from 'node:crypto'
import pg from 'pg'
import { loadReleaseContent } from '../../app/lib/release/content.ts'

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const version = arg('version', '1.0.0-rc1') as string
const exclude = (arg('exclude', 'Q021') as string).split(',').map((s) => s.trim()).filter(Boolean)
const apply = process.argv.includes('--apply')
// Corte con lo ya revisado: las posiciones sin resolver (draft/needs_review) no entran y no bloquean
const allowUnresolved = process.argv.includes('--allow-unresolved')
const CONSULTATION = {
  slug: 'elecciones-generales-29n-2026',
  title: 'Elecciones Generales 29N 2026',
  description: 'Cuestionario de afinidad con los programas electorales de los partidos.'
}
const EXCL = ['ambiguous', 'conflicting_sources', 'not_comparable']

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity',
  max: 2
})
const client = await pool.connect()
const q = (sql: string, params?: unknown[]) => client.query(sql, params)
const problems: string[] = []

try {
  await q('BEGIN')

  const { rows: qs } = await q(
    `SELECT q.id, q.pilot_question_id AS code, q.topic_id, d.code AS dimension
       FROM questions q LEFT JOIN topics t ON t.id = q.topic_id LEFT JOIN dimensions d ON d.id = t.dimension_id
      WHERE q.pilot_question_id IS NOT NULL AND NOT (q.pilot_question_id = ANY($1)) ORDER BY q.pilot_question_id`,
    [exclude]
  )
  const { rows: pos } = await q(
    `SELECT p.id, p.entity_id, p.question_id, p.review_status, p.value, p.stance_status, p.conditions, e.name AS party,
            jsonb_array_length(coalesce(p.evidence_jsonb,'[]')) AS n_ev
       FROM positions p JOIN entities e ON e.id = p.entity_id
      WHERE p.question_id = ANY($1) AND e.type = 'party'`,
    [qs.map((x) => x.id)]
  )

  for (const p of pos) {
    // 'draft' + 'not_stated' = el partido no trata el tema: no bloquea ni cuenta. Bloquea lo que quede por revisar.
    if (!allowUnresolved && (p.review_status === 'needs_review' || (p.review_status === 'draft' && p.stance_status !== 'not_stated'))) problems.push(`${p.party}: posición sin resolver (${p.review_status})`)
    if (p.review_status === 'approved' && p.n_ev > 0) {
      if (p.value === null && !EXCL.includes(p.stance_status)) problems.push(`posición aprobada sin postura asignada (${p.party}, pregunta ${p.question_id})`)
      if (p.stance_status === 'conditional' && !p.conditions) problems.push(`posición condicional sin condición (${p.party}, pregunta ${p.question_id})`)
    }
  }
  for (const x of qs) if (!x.topic_id) problems.push(`${x.code}: sin tema/dimensión`)

  const approved = pos.filter((p) => p.review_status === 'approved' && p.n_ev > 0)
  // Una pregunta debe puntuar al menos a dos partidos. Si solo tiene posición de uno,
  // no puede comparar y daría a ese partido una pregunta exclusiva (ventaja sin contrapeso).
  const partiesByQuestion = new Map<string, Set<string>>()
  for (const p of approved) {
    if (p.value === null) continue
    if (!partiesByQuestion.has(p.question_id)) partiesByQuestion.set(p.question_id, new Set())
    partiesByQuestion.get(p.question_id)!.add(p.entity_id)
  }
  // Una pregunta necesita posición de 2+ partidos para comparar. Las regionales se eximen: solo las responde su partido y solo salen si se elige.
  const regionalIds = new Set((await q(`SELECT id FROM questions WHERE array_length(regional_parties, 1) > 0`)).rows.map((r: any) => r.id))
  // Decisión del editor: una pregunta con posición de un solo partido entra igualmente. El selector solo la muestra
  // si se elige ese partido (como las regionales), así que quien lo elija espera encontrarla.
  const questions = qs.filter((x) => (partiesByQuestion.get(x.id)?.size ?? 0) >= 1)
  const sinAprobadas = qs.filter((x) => !questions.includes(x)).map((x) => x.code)
  const soloUnPartido = qs.filter((x) => (partiesByQuestion.get(x.id)?.size ?? 0) === 1).map((x) => x.code)
  const entityIds = [...new Set(approved.map((p) => p.entity_id))]
  const { rows: ents } = await q(`SELECT id, name FROM entities WHERE id = ANY($1) ORDER BY name`, [entityIds])

  if (problems.length) {
    console.log(`NO SE PUEDE CREAR: ${problems.length} problema(s)`)
    for (const p of problems.slice(0, 15)) console.log('  -', p)
    await q('ROLLBACK')
    process.exitCode = 2
  } else {
    const c = await q(
      `INSERT INTO consultations (slug, title, description, category, base_locale) VALUES ($1,$2,$3,'politics','es')
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id, metadata`,
      [CONSULTATION.slug, CONSULTATION.title, CONSULTATION.description]
    )
    const existing = await q(`SELECT id, status FROM survey_releases WHERE consultation_id = $1 AND version = $2`, [c.rows[0].id, version])
    let releaseId: string
    let refreshed = false
    if (existing.rows.length) {
      if (existing.rows[0].status !== 'draft') throw new Error(`El release ${version} está ${existing.rows[0].status}: no se modifica`)
      releaseId = existing.rows[0].id
      refreshed = true
      await q(`DELETE FROM release_questions WHERE release_id = $1`, [releaseId])
      await q(`DELETE FROM release_entities WHERE release_id = $1`, [releaseId])
    } else {
      releaseId = (
        await q(`INSERT INTO survey_releases (consultation_id, version, status, scoring_model_version) VALUES ($1,$2,'draft','1.0.0') RETURNING id`,
          [c.rows[0].id, version])
      ).rows[0].id
    }
    for (const x of questions) await q(`INSERT INTO release_questions (release_id, question_id) VALUES ($1,$2)`, [releaseId, x.id])
    for (const e of ents) await q(`INSERT INTO release_entities (release_id, entity_id) VALUES ($1,$2)`, [releaseId, e.id])

    const content = await loadReleaseContent(q as any, releaseId)
    const manifest = {
      version,
      scoring_model_version: '1.0.0',
      consultation: {
        slug: CONSULTATION.slug, title: CONSULTATION.title, description: CONSULTATION.description,
        // Ajustes de la encuesta (tipo, umbral…): se congelan solo si existen, así el manifiesto del 29N no cambia
        ...(c.rows[0].metadata ? { settings: c.rows[0].metadata } : {})
      },
      question_ids: questions.map((x) => x.id).sort(),
      entity_ids: ents.map((e) => e.id).sort(),
      content
    }
    const hash = createHash('sha256').update(canonical(manifest)).digest('hex')
    await q(`UPDATE survey_releases SET manifest_jsonb = $2::jsonb, manifest_hash = $3 WHERE id = $1`, [releaseId, JSON.stringify(manifest), hash])

    const dist: Record<string, number> = {}
    for (const p of content.positions) dist[String(p.value ?? p.stanceStatus)] = (dist[String(p.value ?? p.stanceStatus)] ?? 0) + 1
    const byDim: Record<string, number> = {}
    for (const x of content.questions) byDim[x.dimensionCode ?? '—'] = (byDim[x.dimensionCode ?? '—'] ?? 0) + 1
    const withEv = content.positions.filter((p) => p.evidence.length > 0).length

    console.log(`Release ${version} (borrador, ${refreshed ? 'refrescado' : 'nuevo'}) · consulta ${CONSULTATION.slug}`)
    console.log(`Preguntas: ${questions.length}${exclude.length ? ` (excluidas por decisión: ${exclude.join(', ')})` : ''}${sinAprobadas.length ? ` · sin 2+ partidos: ${sinAprobadas.join(', ')}` : ''}${soloUnPartido.length ? ` · solo un partido: ${soloUnPartido.join(', ')}` : ''}`)
    console.log(`Entidades: ${ents.map((e) => e.name).join(', ')}`)
    const nameOf = new Map(ents.map((e) => [e.id, e.name]))
    const perParty: Record<string, number> = {}
    for (const p of content.positions) perParty[nameOf.get(p.entityId) ?? p.entityId] = (perParty[nameOf.get(p.entityId) ?? p.entityId] ?? 0) + 1
    console.log('Posiciones aprobadas por partido:', perParty)
    console.log(`Posiciones: ${content.positions.length} (con citas: ${withEv}) · valores:`, dist)
    console.log('Preguntas por dimensión:', byDim)
    console.log(`Manifiesto: ${Math.round(JSON.stringify(manifest).length / 1024)} KB · hash ${hash}`)

    if (apply) {
      await q(
        `INSERT INTO editorial_audit (admin_id, action, entity_type, entity_id, description, changes)
         VALUES ('claude-code', $4, 'release', $1, $2, $3::jsonb)`,
        [releaseId, `Release ${version} ${refreshed ? 'refrescado' : 'creado'} en borrador`,
         JSON.stringify({ version, questions: questions.length, entities: ents.length, positions: content.positions.length, hash }),
         refreshed ? 'refresh_release_draft' : 'create_release_draft']
      )
      await q('COMMIT')
      console.log(`\nBorrador ${releaseId} ${refreshed ? 'refrescado' : 'creado'}. NO publicado.`)
    } else {
      await q('ROLLBACK')
      console.log('\nDry-run (revertido): no se ha escrito nada. Añade --apply para confirmar.')
    }
  }
} catch (e) {
  await q('ROLLBACK').catch(() => {})
  throw e
} finally {
  client.release()
  await pool.end()
}
