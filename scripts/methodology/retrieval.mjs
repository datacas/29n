// Utilidades de recuperación documental para el diagnóstico (solo lectura, deterministas, sin modelos).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ROOT } from './lib.mjs'

const STOP = new Set('de la el los las un una unos unas y o u e en a al del por para con sin que se su sus lo le les como mas ser debe deben deberia hacia sobre entre este esta estos estas ese esa es son ha han hay no si'.split(' '))
export const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const SUF = /(aciones|acion|amientos|amiento|imientos|imiento|idades|idad|mente|ando|iendo|ados|adas|idos|idas|ado|ada|ido|ida|ares|eres|ires|ar|er|ir|es|os|as|s)$/
export const stem = (w) => { const m = w.match(SUF); return m && w.length - m[0].length >= 4 ? w.slice(0, w.length - m[0].length) : w }
export function tokens(s, { stemming = false } = {}) {
  const t = fold(s).replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
  return stemming ? t.map(stem) : t
}
export function loadProgram(prog, { minChars = 350 } = {}) {
  const pdf = path.join(ROOT, 'app/public/programas', prog.file)
  const text = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString()
  const pages = text.split('\f'); const paras = []
  pages.forEach((pg, i) => {
    let buf = ''
    for (const para of pg.split(/\n\s*\n/)) { const t = para.replace(/\s+/g, ' ').trim(); if (!t) continue; buf = buf ? buf + ' ' + t : t; if (buf.length >= minChars) { paras.push({ page: i + 1, text: buf }); buf = '' } }
    if (buf.length > 60) paras.push({ page: i + 1, text: buf })
  })
  return { pages, paras, language: prog.language }
}
// Ventana de n párrafos contiguos (contexto adyacente)
export const windows = (paras, n = 2) => paras.map((p, i) => ({ page: p.page, pages: [p.page, paras[i + 1]?.page ?? p.page], text: [p.text, ...paras.slice(i + 1, i + n).map((x) => x.text)].join(' ') }))
export function buildIndex(docs, opts) {
  const tf = docs.map((d) => { const m = new Map(); for (const w of tokens(d.text, opts)) m.set(w, (m.get(w) ?? 0) + 1); return m })
  const df = new Map(); tf.forEach((m) => m.forEach((_, w) => df.set(w, (df.get(w) ?? 0) + 1)))
  const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0)); const avg = len.reduce((a, b) => a + b, 0) / (len.length || 1)
  return { docs, tf, df, len, avg, N: docs.length, opts }
}
export function bm25(ix, qTokens, k = 20, { k1 = 1.5, b = 0.75 } = {}) {
  const q = [...new Set(qTokens)]
  const sc = ix.docs.map((_, i) => { let s = 0, hit = 0; for (const w of q) { const f = ix.tf[i].get(w); if (!f) continue; hit++; const d = ix.df.get(w) ?? 0; s += (Math.log(1 + (ix.N - d + 0.5) / (d + 0.5)) * f * (k1 + 1)) / (f + k1 * (1 - b + (b * ix.len[i]) / ix.avg)) } return { i, s, hit } })
  return sc.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k)
}
// Realimentación por pseudo-relevancia: añade los términos más característicos de los 3 primeros resultados
export function prf(ix, qTokens, base, nTerms = 6, nDocs = 3) {
  const w = new Map()
  for (const { i } of base.slice(0, nDocs)) ix.tf[i].forEach((f, t) => { if (!qTokens.includes(t)) w.set(t, (w.get(t) ?? 0) + f * Math.log(1 + ix.N / (ix.df.get(t) ?? 1))) })
  return [...qTokens, ...[...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, nTerms).map(([t]) => t)]
}
export function rrf(lists, k = 20, c = 60) {
  const m = new Map(); for (const l of lists) l.forEach((x, r) => m.set(x.i, (m.get(x.i) ?? 0) + 1 / (c + r + 1)))
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([i, s]) => ({ i, s }))
}
// ¿Cubre este pasaje la cita registrada? (solapamiento de términos de la cita ≥ umbral y página a ≤1)
export function quoteHit(passage, quote, page, { stemming = true, thr = 0.6 } = {}) {
  const pgs = passage.pages ?? [passage.page]
  if (page && !pgs.some((p) => Math.abs(p - page) <= 1)) return false
  const qt = [...new Set(tokens(quote, { stemming }).filter((w) => w.length > 3))]; if (!qt.length) return false
  const pt = new Set(tokens(passage.text, { stemming }))
  return qt.filter((w) => pt.has(w)).length / qt.length >= thr
}
