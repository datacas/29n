// Paso 1 (JS, local) de la prueba de recuperación v2 sobre las celdas del piloto: segmenta con la v2, rankea con BM25 V7 (misma consulta y vocabulario por ítem que B-1.0.0,
// del fichero de expansiones ya generado: NO se llama a ningún modelo) y escribe los pasajes y rankings para el paso 2 (retrieval_v2_build.py). Solo conjunto S.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, ROOT } from './lib.mjs'
import { tokens, buildIndex, bm25 } from './retrieval.mjs'
import { loadProgramV2 } from './retrieval_v2.mjs'
const r = loadRelease('2.1.2'); const EXP = JSON.parse(fs.readFileSync(path.join(OUT, 'expansions_dev.json'), 'utf8'))
const pilot = JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8')).cells.map((c) => c.cellId)
const split = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8')); const inS = new Set(split.S.map((c) => `${c.questionId}|${c.entityId}`))
if (!pilot.every((id) => inS.has(id))) { console.error('Hay celdas fuera del conjunto S: se aborta (E sellado).'); process.exit(2) }
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const Q = Object.fromEntries(r.questions.map((q) => [q.questionId, q])); const E = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const dir = path.join(OUT, 'v2'); fs.mkdirSync(dir, { recursive: true })
const ix = {}; const cells = []; const stats = {}
for (const id of pilot) {
  const [qid, eid] = id.split('|'); const q = Q[qid], e = E[eid]; const ex = EXP[qid]; if (!ex?.terms) throw new Error('Sin expansión para ' + qid)
  if (!ix[e.name]) { const raw = loadProgramV2(byName[e.name]); ix[e.name] = { index: buildIndex(raw.paras, { stemming: true }), slug: byName[e.name].slug }; stats[e.name] = raw.stats }
  const qt = tokens(q.canonicalText + ' ' + (q.contextText ?? '') + ' ' + ex.terms.join(' '), { stemming: true })
  cells.push({ cellId: id, party: e.name, slug: byName[e.name].slug, item: q.canonicalText, context: q.contextText ?? '', expansion_es: ex.terms.join(' '), bm25_v7: bm25(ix[e.name].index, qt, 200).map((x) => x.i) })
}
for (const [name, p] of Object.entries(ix)) fs.writeFileSync(path.join(dir, `passages_${p.slug}.json`), JSON.stringify(p.index.docs.map((d) => ({ page: d.page, pages: d.pages, text: d.text, extended: d.extended }))))
fs.writeFileSync(path.join(dir, 'cells_pilot.json'), JSON.stringify({ cells, stats }))
console.log(JSON.stringify({ celdas: cells.length, partidos: Object.keys(ix).length, segmentacion: stats }))
