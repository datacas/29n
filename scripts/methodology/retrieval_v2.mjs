// Segmentación v2 (propuesta de la configuración de recuperación B-2.0.0; la B-1.0.0 sigue congelada). Solo cambia la SEGMENTACIÓN: cuando un fragmento termina cortado
// a mitad de frase (sin puntuación final y con una continuación evidente), se amplía con los párrafos siguientes hasta cerrar la frase —también al cambiar de página—, con un tope.
// Local y determinista; no usa modelos de lenguaje.
import { loadProgram } from './retrieval.mjs'

const END = /[.!?:;»”"')\]…]\s*$/
const CONT = /^[a-zà-ÿñç·,;)\]]/                       // la continuación empieza en minúscula (o signo): la frase sigue
const OPEN_END = /(,|;|\b(y|e|o|u|de|del|la|el|los|las|que|con|en|a|para|por|como|se|su|sus|al|un|una|els|les|dos|das|do|da|ou|e)\s*)$/i
export const MAX_EXTRA_CHARS = 900
export const MAX_MERGES = 3

export const isCut = (cur, next) => !END.test(cur.trim()) && (CONT.test(next.trim()) || OPEN_END.test(cur.trim()))

export function loadProgramV2(prog, opts) {
  const base = loadProgram(prog, opts); const src = base.paras; const out = []; let extended = 0
  for (let i = 0; i < src.length; i++) {
    let cur = { page: src[i].page, pages: [src[i].page], text: src[i].text, extended: false }; let merges = 0
    while (i + 1 < src.length && merges < MAX_MERGES && cur.text.length - src[i].text.length < MAX_EXTRA_CHARS && isCut(cur.text, src[i + 1].text)) {
      i++; merges++; cur.text += ' ' + src[i].text; if (!cur.pages.includes(src[i].page)) cur.pages.push(src[i].page); cur.extended = true
    }
    if (cur.extended) extended++
    out.push(cur)
  }
  return { pages: base.pages, paras: out, language: base.language, stats: { v1: src.length, v2: out.length, extended } }
}
