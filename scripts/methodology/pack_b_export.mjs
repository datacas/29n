// Modalidad B · paso 1 (JS, solo lectura): para cada celda de S exporta el ranking BM25 V7 (consulta = pregunta + contexto + vocabulario por ítem).
// El paso 2 (pack_b_build.py) fusiona con BGE-M3 por RRF, reordena con bge-reranker-v2-m3 y escribe el paquete con K=10. Solo conjunto S (desarrollo); E no se toca.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, ROOT } from './lib.mjs'
import { tokens, loadProgram, buildIndex, bm25 } from './retrieval.mjs'
const r = loadRelease('2.1.2'); const split = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8'))
const EXP = JSON.parse(fs.readFileSync(path.join(OUT, 'expansions_dev.json'), 'utf8')); const SET = process.argv[2] ?? 'S'
if (SET === 'E') { console.error('E está sellado: no se exporta en esta fase.'); process.exit(2) }
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const Q = Object.fromEntries(r.questions.map((q) => [q.questionId, q])); const E = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const ix = {}; const cells = []
for (const c of split[SET]) {
  const q = Q[c.questionId], e = E[c.entityId]; const ex = EXP[c.questionId]; if (!ex?.terms) throw new Error('Sin expansión para ' + c.questionId)
  ix[e.name] ??= buildIndex(loadProgram(byName[e.name]).paras, { stemming: true })
  const qt = tokens(q.canonicalText + ' ' + (q.contextText ?? '') + ' ' + ex.terms.join(' '), { stemming: true })
  cells.push({ cellId: `${c.questionId}|${c.entityId}`, party: e.name, slug: byName[e.name].slug, item: q.canonicalText, context: q.contextText ?? '', expansion_es: ex.terms.join(' '), bm25_v7: bm25(ix[e.name], qt, 200).map((x) => x.i) })
}
fs.mkdirSync(path.join(OUT, 'packB'), { recursive: true }); fs.writeFileSync(path.join(OUT, 'packB', `cells_${SET}.json`), JSON.stringify({ set: SET, release_sha256: r._sha256, cells })); console.log(`${SET}: ${cells.length} celdas exportadas`)
