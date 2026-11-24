/**
 * Programas con fichas «medida + Porque…» (p. ej. Adelante Andalucía): el extractor a veces coge solo la frase de
 * justificación, sin la medida que la precede. Aquí se reconstruye la ficha leyendo los bloques del PDF con sus
 * coordenadas (pdftotext -bbox-layout), porque en los diseños a dos columnas el párrafo anterior en lectura lineal
 * suele ser de otra ficha.
 */
import { execFileSync } from 'node:child_process'

export const JUSTIFICATION = /^(porque|pues|ya que|puesto que)\b/i
export const isJustification = (t: string) => JUSTIFICATION.test(t.trim())

interface Block { x0: number; y0: number; x1: number; y1: number; text: string }

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" }
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m] ?? m)
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const cache = new Map<string, Block[]>()
export function pageBlocks(pdf: string, page: number): Block[] {
  const key = `${pdf}#${page}`
  const hit = cache.get(key)
  if (hit) return hit
  const xml = execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-bbox-layout', pdf, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const blocks: Block[] = []
  for (const m of xml.matchAll(/<block xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/block>/g)) {
    const words = [...m[5].matchAll(/<word[^>]*>([^<]*)<\/word>/g)].map((w) => decode(w[1]))
    blocks.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], text: norm(words.join(' ')) })
  }
  cache.set(key, blocks)
  return blocks
}

/**
 * Devuelve «medida […] Porque…» con los bloques de la misma columna que preceden a la justificación (máx. 3),
 * o null si no se localiza el bloque o no hay nada que añadir.
 */
export function withProposal(pdf: string, page: number, quote: string): string | null {
  const blocks = pageBlocks(pdf, page)
  const head = norm(quote).slice(0, 40).toLowerCase()
  const cur = blocks.find((b) => b.text.toLowerCase().startsWith(head))
  if (!cur) return null
  const col = blocks
    .filter((b) => b !== cur && Math.abs(b.x0 - cur.x0) <= 6 && b.y1 <= cur.y0 + 2 && !/^\d{1,3}$/.test(b.text) && b.text.length >= 8)
    .sort((a, b) => b.y1 - a.y1)
  const chain: Block[] = []
  let top = cur.y0
  for (const b of col) {
    if (isJustification(b.text)) break // la justificación de la ficha anterior: aquí empieza otra ficha
    if (top - b.y1 > 45) break
    chain.unshift(b)
    top = b.y0
    if (chain.length >= 3) break
  }
  if (!chain.length) return null
  return [...chain.map((b) => b.text), quote.trim()].join(' […] ')
}
