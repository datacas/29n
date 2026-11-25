// Fase 1 · Paquete de entrada del benchmark reducido (solo lectura; NO llama a ningún modelo).
// Para cada celda de S, D y E (benchmark_split.mjs) recupera los pasajes candidatos del programa del partido con BM25
// sobre el texto del PDF (pdftotext), igual para todos los modelos. Mide además el recall de la recuperación contra la
// página de la cita ya codificada (solo informativo; no entra en el prompt de ningún modelo).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadRelease, ROOT, OUT, write } from './lib.mjs'

const version = process.argv[2] ?? '2.1.2'
const K = +(process.argv[3] ?? 6)
const r = loadRelease(version)
const split = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8'))
const programs = (await import(path.join(ROOT, 'app/lib/programs.ts').replace(/\.ts$/, '.ts')).catch(() => null))
const PROGRAMS = programs?.PROGRAMS ?? JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/programas/parties.json'), 'utf8')).map?.((p) => p) ?? []
const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const STOP = new Set('de la el los las un una unos unas y o u e en a al del por para con sin que se su sus lo le les como más mas ser debe deben debería hacia sobre entre este esta estos estas ese esa es son ha han hay no si sí'.split(' '))
const toks = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))

const cache = {}
function index(name) {
  if (cache[name]) return cache[name]
  const prog = byName[name]
  if (!prog) throw new Error(`Sin programa para ${name}`)
  const pdf = path.join(ROOT, 'app/public/programas', prog.file)
  const text = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString()
  const docs = []
  text.split('\f').forEach((pg, i) => {
    let buf = ''
    for (const para of pg.split(/\n\s*\n/)) {
      const t = para.replace(/\s+/g, ' ').trim()
      if (!t) continue
      buf = buf ? buf + ' ' + t : t
      if (buf.length >= 350) { docs.push({ page: i + 1, text: buf }); buf = '' }
    }
    if (buf.length > 60) docs.push({ page: i + 1, text: buf })
  })
  const tf = docs.map((d) => { const m = new Map(); for (const w of toks(d.text)) m.set(w, (m.get(w) ?? 0) + 1); return m })
  const df = new Map(); tf.forEach((m) => m.forEach((_, w) => df.set(w, (df.get(w) ?? 0) + 1)))
  const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0)); const avg = len.reduce((a, b) => a + b, 0) / len.length
  return (cache[name] = { docs, tf, df, len, avg, N: docs.length, language: prog.language, file: prog.file })
}
function search(ix, query, k) {
  const q = [...new Set(toks(query))]; const k1 = 1.5, b = 0.75
  const sc = ix.docs.map((_, i) => { let s = 0; for (const w of q) { const f = ix.tf[i].get(w); if (!f) continue; const idf = Math.log(1 + (ix.N - (ix.df.get(w) ?? 0) + 0.5) / ((ix.df.get(w) ?? 0) + 0.5)); s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * ix.len[i]) / ix.avg)) } return [s, i] })
  return sc.sort((a, b) => b[0] - a[0]).slice(0, k).filter(([s]) => s > 0).map(([s, i]) => ({ page: ix.docs[i].page, score: +s.toFixed(2), text: ix.docs[i].text.slice(0, 1200) }))
}
const qd = Object.fromEntries(r.questions.map((q) => [q.questionId, q]))
const ed = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const posOf = new Map(r.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const pack = { meta: { release: version, sha256: r._sha256, k: K, retrieval: 'BM25 por párrafo; consulta = texto del ítem; idéntico para todos los modelos', splitMeta: split.meta }, S: [], D: [], E: [] }
const recall = { S: [0, 0], D: [0, 0], E: [0, 0] }
for (const set of ['S', 'D', 'E']) for (const c of split[set]) {
  const q = qd[c.questionId], e = ed[c.entityId]; const ix = index(e.name)
  const passages = search(ix, q.canonicalText, K)
  const p = posOf.get(c.questionId + '|' + c.entityId); const page = p?.evidence?.[0]?.page ?? p?.claimPage ?? null
  if (page) { recall[set][1]++; if (passages.some((x) => Math.abs(x.page - page) <= 1)) recall[set][0]++ }
  pack[set].push({ cellId: `${c.questionId}|${c.entityId}`, set, party: e.name, language: ix.language, item: q.canonicalText, context: q.contextText ?? '', passages, stratum: c.stratum })
}
pack.meta.retrievalRecallPageWithinOne = Object.fromEntries(Object.entries(recall).map(([k, [a, b]]) => [k, b ? +(a / b).toFixed(3) : null]))
pack.meta.cells = { S: pack.S.length, D: pack.D.length, E: pack.E.length }
write('benchmark_pack.json', pack)
console.log(JSON.stringify(pack.meta, null, 1).slice(0, 900))
