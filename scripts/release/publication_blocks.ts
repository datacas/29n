/**
 * Bloqueos de publicación (issue #53). Se ejecutan al crear un release (build_release.ts) y al verificarlo (verify_freeze.ts).
 * Bloquean (impiden crear/verificar el release) y cada mensaje indica la celda (partido · pregunta) y el motivo:
 *   1. CITA NO VERIFICABLE     la cita literal de una posición no aparece en el PDF original del partido (en su página ±1).
 *   2. SIN RESPALDO DOCUMENTAL una posición con valor sin ninguna cita utilizable (texto ≥ 20 caracteres y página).
 *   3. DISCREPANCIA DE SIGNO   una celda codificada por varios evaluadores con signos opuestos (apoya/se opone) y sin adjudicar. Solo si existen las tablas de evaluación (BD local).
 *   4. ÍTEM SIN ATOMICIDAD O SIN DIRECCIÓN  según el registro versionado `item_reviews.json`, salvo justificación expresa.
 * NO bloquean (solo avisan): cita en otra página, preguntas sin auditar, y las métricas de concordancia (#49), que informan pero no deciden por umbral.
 * Los controles de pertinencia, dirección e intensidad (#53, 4-6) son juicios de un verificador y no se pueden decidir de forma automática; este módulo cubre los deterministas.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { programFor } from '../../app/lib/programs.ts'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
export const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
// Se quitan los números sueltos (números de página o de apartado que el PDF intercala en el texto) de la cita y del documento: así no cuentan como diferencias.
export const flat = (s: unknown) => fold(String(s ?? '')).replace(/-\s+/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s\d{1,4}(?=\s)/g, ' ').replace(/^\d{1,4}\s/, '').replace(/\s\d{1,4}$/, '').replace(/\s+/g, ' ').trim()

const compact = (s: string) => s.replace(/\s+/g, '')
export interface BlockPosition { party: string; questionId: string; value: number | null; evidence: { text?: string | null; page?: number | null }[] }
export interface BlockQuestion { id: string; code: string }
export interface BlockResult { blocks: string[]; warnings: string[] }
export type Verdict = 'ok' | 'otra_pagina' | 'no_encontrada' | 'sin_cita'

const pageCache = new Map<string, string[]>()
export function programPages(party: string): string[] | null {
  const prog = programFor(party); if (!prog) return null
  if (!pageCache.has(prog.file)) {
    const pdf = path.join(ROOT, 'app/public/programas', prog.file)
    if (!fs.existsSync(pdf)) return null
    pageCache.set(prog.file, execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString().split('\f').map(flat))
  }
  return pageCache.get(prog.file)!
}
/** La cita (con elipsis permitidas) debe aparecer literal en la página citada o en las adyacentes. */
export function verifyQuote(quote: string | null | undefined, page: number | null | undefined, pages: string[]): Verdict {
  const frags = String(quote ?? '').split(/…|\.{3}|\[\.\.\.\]|\[…\]/).map(flat).filter((f) => f.split(' ').filter(Boolean).length >= 3).map(compact)
  if (!frags.length) return 'sin_cita'
  // Se compara sin espacios: el PDF parte palabras («cometi dos», «pro genitor») y la extracción no es fiable en los blancos.
  const near = (p: number | null | undefined) => (p ? compact(pages.slice(Math.max(0, p - 2), p + 1).join(' ')) : '')
  const zone = near(page)
  if (zone && frags.every((f) => zone.includes(f))) return 'ok'
  const all = compact(pages.join(' '))
  return frags.every((f) => all.includes(f)) ? 'otra_pagina' : 'no_encontrada'
}

export interface ItemReview { verdict: 'ok' | 'compound' | 'no_direction'; justified?: boolean; note?: string }
export interface ItemRegistry { items: Record<string, ItemReview>; audited: string[] }
export function loadItemReviews(): ItemRegistry {
  const f = path.join(ROOT, 'scripts/release/item_reviews.json'); if (!fs.existsSync(f)) return { items: {}, audited: [] }
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { items: j.items ?? {}, audited: j.audited ?? [] }
}

export function checkContent(questions: BlockQuestion[], positions: BlockPosition[], reg: ItemRegistry = loadItemReviews()): BlockResult {
  const blocks: string[] = [], warnings: string[] = []
  const code = new Map(questions.map((x) => [x.id, x.code]))
  const sinAuditar: string[] = []
  for (const x of questions) {
    const r = reg.items[x.code]
    if (!r && !reg.audited.includes(x.code)) sinAuditar.push(x.code)
    else if (r && r.verdict !== 'ok' && !r.justified) blocks.push(`${x.code}: ítem ${r.verdict === 'compound' ? 'sin atomicidad (doble contenido)' : 'sin dirección definida'} y sin justificación en item_reviews.json`)
  }
  if (sinAuditar.length) warnings.push(`${sinAuditar.length} pregunta(s) sin registro en item_reviews.json (no bloquea): ${sinAuditar.slice(0, 8).join(', ')}${sinAuditar.length > 8 ? '…' : ''}`)
  let otraPagina = 0
  for (const p of positions) {
    if (p.value === null || p.value === undefined) continue
    const cell = `${p.party} · ${code.get(p.questionId) ?? p.questionId}`
    const usable = p.evidence.filter((e) => String(e.text ?? '').trim().length >= 20 && Number.isFinite(Number(e.page)) && Number(e.page) > 0)
    if (!usable.length) { blocks.push(`${cell}: sin respaldo documental suficiente (ninguna cita de ≥ 20 caracteres con página); no puede publicarse como posición determinada`); continue }
    const pages = programPages(p.party)
    if (!pages) { blocks.push(`${cell}: no se encuentra el PDF original del programa para verificar la cita`); continue }
    const verdicts = usable.map((e) => verifyQuote(e.text, Number(e.page), pages))
    if (verdicts.every((v) => v === 'no_encontrada' || v === 'sin_cita')) blocks.push(`${cell}: cita no verificable en el PDF (p. ${usable[0].page}): «${String(usable[0].text).slice(0, 80)}…»`)
    else if (verdicts.some((v) => v === 'otra_pagina')) otraPagina++
  }
  if (otraPagina) warnings.push(`${otraPagina} posición(es) con alguna cita en una página distinta de la indicada (no bloquea)`)
  return { blocks, warnings }
}

/** Discrepancias de signo sin adjudicar en las celdas incluidas (solo BD local con las tablas de evaluación). */
export async function checkSignDiscrepancies(q: (sql: string, p?: unknown[]) => Promise<{ rows: any[] }>, questions: BlockQuestion[]): Promise<BlockResult> {
  const has = (await q(`SELECT to_regclass('public.position_codings') IS NOT NULL AND to_regclass('public.eval_adjudications') IS NOT NULL AND to_regclass('public.eval_cells') IS NOT NULL AS ok`)).rows[0].ok
  if (!has) return { blocks: [], warnings: ['No se comprobaron discrepancias de signo: no hay tablas de evaluación en esta base de datos'] }
  const { rows } = await q(
    `WITH last AS (
       SELECT DISTINCT ON (pc.campaign_id, pc.question_id, pc.entity_id, pc.evaluator_id) pc.campaign_id, pc.question_id, pc.entity_id, pc.evaluator_id, pc.document_class
         FROM position_codings pc
        WHERE pc.campaign_id IS NOT NULL AND pc.question_id = ANY($1) AND pc.execution_status = 'ok' AND pc.document_class IN ('supports','opposes')
        ORDER BY pc.campaign_id, pc.question_id, pc.entity_id, pc.evaluator_id, pc.revision DESC)
     SELECT l.question_id, e.name AS party
       FROM last l JOIN entities e ON e.id = l.entity_id
      GROUP BY l.campaign_id, l.question_id, l.entity_id, e.name
     HAVING count(DISTINCT l.document_class) > 1
        AND NOT EXISTS (SELECT 1 FROM eval_cells ce JOIN eval_adjudications a ON a.cell_id = ce.id
                         WHERE ce.campaign_id = l.campaign_id AND ce.question_id = l.question_id AND ce.entity_id = l.entity_id)`, [questions.map((x) => x.id)])
  const code = new Map(questions.map((x) => [x.id, x.code]))
  return { blocks: rows.map((r) => `${r.party} · ${code.get(r.question_id) ?? r.question_id}: discrepancia de signo entre evaluadores sin adjudicar`), warnings: [] }
}
