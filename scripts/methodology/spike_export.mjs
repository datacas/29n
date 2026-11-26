// Spike de recuperación semántica · exportación (solo lectura, sin modelos, solo preguntas de DESARROLLO; E excluido).
// Exporta los mismos párrafos que usa BM25, las 457 celdas de referencia y, por celda, el ranking BM25 V7 y los párrafos que contienen
// la cita registrada, para que Python compare recuperadores sobre exactamente los mismos datos.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadRelease, usable, OUT, ROOT } from './lib.mjs'
import { tokens, loadProgram, buildIndex, bm25, quoteHit } from './retrieval.mjs'

const r = loadRelease(process.argv[2] ?? '2.1.2')
const split = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8')); const dev = new Set(split.meta.devQuestionIds)
const EXP = JSON.parse(fs.readFileSync(path.join(OUT, 'expansions_dev.json'), 'utf8'))
const lang = (l) => { const f = path.join(OUT, `expansions_dev_${l}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {} }
const EXP_L = { ca: lang('ca'), gl: lang('gl') }
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const Q = Object.fromEntries(r.questions.map((q) => [q.questionId, q])); const E = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const R = r.positions.filter((p) => usable(p) && dev.has(p.questionId) && (p.evidence?.length ?? 0) > 0 && EXP[p.questionId]?.terms)
const dir = path.join(OUT, 'spike'); fs.mkdirSync(dir, { recursive: true })
const parties = {}; const cells = []
for (const p of R) {
  const e = E[p.entityId], q = Q[p.questionId]
  if (!parties[e.name]) { const raw = loadProgram(byName[e.name]); parties[e.name] = { raw, ix: buildIndex(raw.paras, { stemming: true }), slug: byName[e.name].slug, language: byName[e.name].language } }
  const px = parties[e.name]
  const qtxt = q.canonicalText + ' ' + (q.contextText ?? ''); const exp = EXP[q.questionId].terms.join(' ')
  const qt = tokens(qtxt + ' ' + exp, { stemming: true }); const ranked = bm25(px.ix, qt, 200).map((x) => x.i)
  const hits = []; px.ix.docs.forEach((d, i) => { if (p.evidence.some((ev) => Math.abs(d.page - ev.page) <= 1 && quoteHit(d, ev.text, ev.page))) hits.push(i) })
  cells.push({ cellId: `${p.questionId}|${p.entityId}`, party: e.name, language: px.language, item: q.canonicalText, context: q.contextText ?? '', expansion_es: exp, expansion_lang: px.language !== 'es' ? (EXP_L[px.language]?.[q.questionId]?.terms ?? []).join(' ') : '', intensity: Math.abs(p.value), sign: p.value > 0 ? 'pos' : 'neg', bm25_v7: ranked, hit_idx: hits })
}
// Celdas de desarrollo SIN posición registrada (candidatas a auditoría de silencio; NO se consideran omisiones)
const has = new Set(r.positions.map((p) => p.questionId + '|' + p.entityId)); const silence = []
for (const qid of dev) for (const e of r.entities) { if (has.has(qid + '|' + e.entityId) || !byName[e.name]) continue; const q = Q[qid]; if (!EXP[qid]?.terms) continue
  if (!parties[e.name]) { const raw = loadProgram(byName[e.name]); parties[e.name] = { raw, ix: buildIndex(raw.paras, { stemming: true }), slug: byName[e.name].slug, language: byName[e.name].language } }
  const px = parties[e.name]; const qt = tokens(q.canonicalText + ' ' + (q.contextText ?? '') + ' ' + EXP[qid].terms.join(' '), { stemming: true }); const top = bm25(px.ix, qt, 1)[0]
  silence.push({ cellId: `${qid}|${e.entityId}`, party: e.name, language: px.language, item: q.canonicalText, context: q.contextText ?? '', expansion_es: EXP[qid].terms.join(' '), bm25_top1: top ? +top.s.toFixed(2) : 0 }) }
fs.writeFileSync(path.join(dir, 'silence.json'), JSON.stringify(silence))
for (const [name, px] of Object.entries(parties)) fs.writeFileSync(path.join(dir, `passages_${px.slug}.json`), JSON.stringify(px.ix.docs.map((d) => ({ page: d.page, text: d.text }))))
const meta = { release: r.version, sha256: r._sha256, devCells: cells.length, parties: Object.fromEntries(Object.entries(parties).map(([k, v]) => [k, { slug: v.slug, language: v.language, passages: v.ix.docs.length }])), totalPassages: Object.values(parties).reduce((a, v) => a + v.ix.docs.length, 0), sinHitEnPDF: cells.filter((c) => !c.hit_idx.length).length, corpusSha: crypto.createHash('sha256').update(Object.values(parties).map((v) => v.ix.docs.map((d) => d.text).join('\n')).join('\n')).digest('hex') }
fs.writeFileSync(path.join(dir, 'cells.json'), JSON.stringify({ meta, cells })); console.log(JSON.stringify({ celdas: meta.devCells, partidos: Object.keys(meta.parties).length, parrafosTotales: meta.totalPassages, celdasSinParrafoConCita: meta.sinHitEnPDF }))
