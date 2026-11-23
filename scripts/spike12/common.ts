/**
 * Utilidades compartidas de los scripts de SPIKE-12 (Node >= 24, sin transpilar).
 * Solo lectura sobre `positions`: nada aquí modifica review_status.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import type { PageText } from '../../app/lib/jev/quote.ts'
import type { PositionInput } from '../../app/lib/jev/types.ts'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const OUT_DIR = join(ROOT, 'docs', 'spike12')

export function dbPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity',
    max: 4
  })
}

/** Posiciones propuestas pendientes de revisión humana (con evidencia). */
export async function loadPendingPositions(pool: pg.Pool, statuses?: string[]): Promise<PositionInput[]> {
  const { rows } = await pool.query(
    `SELECT p.id, e.name AS party, q.pilot_question_id, q.canonical_text,
            p.stance_status, p.evidence_jsonb
       FROM positions p
       JOIN entities e ON e.id = p.entity_id
       JOIN questions q ON q.id = p.question_id
      WHERE p.evidence_jsonb IS NOT NULL
        AND jsonb_array_length(p.evidence_jsonb) > 0
        AND ${statuses ? 'p.review_status = ANY($1)' : "p.review_status <> 'approved'"}
      ORDER BY q.pilot_question_id, e.name`,
    statuses ? [statuses] : []
  )
  return rows.map((r) => ({
    positionId: r.id,
    party: r.party,
    questionId: r.pilot_question_id,
    questionText: r.canonical_text,
    proposedStanceStatus: r.stance_status,
    claims: (r.evidence_jsonb as any[]).map((c) => ({
      literalText: c.literal_text ?? '',
      normalizedText: c.normalized_text ?? null,
      conditions: c.conditions ?? null,
      sourcePage: c.source_page ?? null,
      claudeStance: c.stance ?? null
    }))
  }))
}

// Partidos y PDF: docs/programas/parties.json (la ruta de cada PDF es relativa a docs/programas)
export interface PartyDef { name: string; file: string; language: string }
export const PARTY_LIST: PartyDef[] = JSON.parse(readFileSync(join(ROOT, 'docs', 'programas', 'parties.json'), 'utf8'))
export const PARTY_NAMES = PARTY_LIST.map((p) => p.name)

const pageCache = new Map<string, PageText[] | undefined>()

/** Texto por página del PDF del partido; undefined si no hay PDF (la cita queda 'no_source'). */
export function loadPageTexts(party: string): PageText[] | undefined {
  if (pageCache.has(party)) return pageCache.get(party)
  const def = PARTY_LIST.find((p) => p.name === party)
  const file = def ? join(ROOT, 'docs', 'programas', def.file) : null
  let pages: PageText[] | undefined
  if (file && existsSync(file)) {
    try {
      const out = execFileSync('pdftotext', ['-layout', file, '-'], { maxBuffer: 512 * 1024 * 1024 }).toString('utf8')
      pages = out.split('\f').map((text, i) => ({ page: i + 1, text })).filter((p) => p.text.trim())
    } catch {
      pages = undefined
    }
  }
  pageCache.set(party, pages)
  return pages
}

export function requireKeyOrExplain(): void {
  if (!process.env.TYPESAFE_API_KEY && !process.env.JEV_API_KEY) {
    console.error(
      [
        'BLOQUEADO: falta TYPESAFE_API_KEY (o JEV_API_KEY).',
        'No se simulan resultados reales. Define la variable y vuelve a ejecutar:',
        '  node --env-file=.env scripts/spike12/<script>.ts      (si la clave está en .env)',
        'El adaptador sí está probado con mocks: npx vitest run tests/jev'
      ].join('\n')
    )
    process.exit(2)
  }
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}
