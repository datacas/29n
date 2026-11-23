/**
 * Comprobación determinista de que una cita literal existe en el texto del PDF.
 * No usa ningún modelo: es la parte que Jev no debe hacer.
 */
import type { QuoteStatus } from './types.ts'

export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/­/g, '') // guion blando
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2') // palabra partida a fin de línea
    .replace(/[«»“”"'’‘`]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Las citas pueden traer "..." o "[...]" para saltarse texto: se verifica cada fragmento. */
export function quoteFragments(quote: string, minLength = 20): string[] {
  return quote
    .split(/\[?\s*(?:\.{3}|…)\s*\]?/)
    .map(normalizeText)
    .filter((f) => f.length >= minLength)
}

function tokens(s: string): string[] {
  return s.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2)
}

function containment(fragment: string, haystack: string): number {
  const ft = tokens(fragment)
  if (ft.length === 0) return 0
  const hs = new Set(tokens(haystack))
  let hit = 0
  for (const t of ft) if (hs.has(t)) hit++
  return hit / ft.length
}

export interface PageText {
  page: number
  text: string
}

/**
 * @param pages texto por página del documento fuente; vacío o undefined => 'no_source'
 * @param page  página indicada por el extractor; se mira ±1 por desfases
 */
export function verifyQuote(quote: string, pages: PageText[] | undefined, page?: number | null): QuoteStatus {
  if (!pages || pages.length === 0) return 'no_source'
  const frags = quoteFragments(quote)
  if (frags.length === 0) return 'not_found'

  const scoped =
    page != null ? pages.filter((p) => Math.abs(p.page - page) <= 1) : pages
  const scopes = scoped.length > 0 ? [scoped, pages] : [pages]

  for (const scope of scopes) {
    const hay = normalizeText(scope.map((p) => p.text).join(' \n '))
    if (frags.every((f) => hay.includes(f))) return 'exact'
  }
  // Tolerancia a diferencias de extracción (guiones, columnas, ligaduras)
  const hayScoped = normalizeText((scoped.length > 0 ? scoped : pages).map((p) => p.text).join(' '))
  if (frags.every((f) => containment(f, hayScoped) >= 0.9)) return 'fuzzy'
  return 'not_found'
}
