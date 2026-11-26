// Paso 1 (JS, local) de los paquetes de evidencia de la campaña humana: para cada celda elegida (y sus reemplazos/reservas predefinidos) exporta el ranking BM25 V7 (misma consulta que B-1.0.0).
// No llama a modelos (el vocabulario por ítem es el ya generado). Solo preguntas de desarrollo; E sellado.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, ROOT } from './lib.mjs'
import { tokens, loadProgram, buildIndex, bm25 } from './retrieval.mjs'
const d = JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'sample_draw.json'), 'utf8')); const sp = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8')); const dev = new Set(sp.meta.devQuestionIds)
const ids = [...new Set([...d.R.map((c) => c.id), ...d.R.map((c) => c.replacement).filter(Boolean), ...d.T1.map((c) => c.id), ...d.T2.map((c) => c.id), ...d.Treserve.map((c) => c.id)])]
if (!ids.every((id) => dev.has(id.split('|')[0]))) { console.error('Hay celdas fuera del desarrollo: se aborta (E sellado).'); process.exit(2) }
const r = loadRelease('2.1.2'); const EXP = JSON.parse(fs.readFileSync(path.join(OUT, 'expansions_dev.json'), 'utf8'))
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const Q = Object.fromEntries(r.questions.map((q) => [q.questionId, q])); const E = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const ix = {}; const cells = []
for (const id of ids) {
  const [qid, eid] = id.split('|'); const q = Q[qid], e = E[eid]; const ex = EXP[qid]; if (!ex?.terms) throw new Error('Sin expansión para ' + qid)
  ix[e.name] ??= buildIndex(loadProgram(byName[e.name]).paras, { stemming: true })
  const qt = tokens(q.canonicalText + ' ' + (q.contextText ?? '') + ' ' + ex.terms.join(' '), { stemming: true })
  cells.push({ cellId: id, party: e.name, slug: byName[e.name].slug, language: byName[e.name].language, item: q.canonicalText, context: q.contextText ?? '', expansion_es: ex.terms.join(' '), bm25_v7: bm25(ix[e.name], qt, 200).map((x) => x.i) })
}
fs.writeFileSync(path.join(OUT, 'h150', 'cells_h150.json'), JSON.stringify({ cells })); console.log(JSON.stringify({ celdas: cells.length, partidos: Object.keys(ix).length }))
