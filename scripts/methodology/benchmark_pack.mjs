// Fase 1 · Paquete de entrada del benchmark reducido, v2 (solo lectura; NO llama a ningún modelo).
// Dos modalidades por celda:
//   B (extremo a extremo): K pasajes recuperados automáticamente (BM25 con lematización ligera + consulta ampliada por ítem).
//   A (evidencia de referencia): para celdas con cita registrada y verificada en el PDF, la cita (pasaje que la contiene)
//     mezclada con K-1 pasajes de B como distractores, en orden determinista (la referencia NO va siempre la primera).
//     La cita registrada NO es referencia dorada independiente: solo garantiza que la evidencia candidata está presente.
// Para las celdas sin posición registrada no hay referencia: solo existe B (y la modalidad A no las puntúa).
// La expansión por ítem la genera un modelo gratuito con un prompt fijo (docs/methodology/local/gen_expansions.mjs). Sin expansión → falla.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, ROOT, OUT, write, rng, usable } from './lib.mjs'
import { tokens, loadProgram, buildIndex, bm25, quoteHit } from './retrieval.mjs'

const version = process.argv[2] ?? '2.1.2'
const K = +(process.argv[3] ?? 15)
const r = loadRelease(version)
const split = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8'))
const expFile = path.join(OUT, process.env.EXPANSIONS ?? 'expansions_dev.json')
const EXP = fs.existsSync(expFile) ? JSON.parse(fs.readFileSync(expFile, 'utf8')) : {}
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts'))
const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const qd = Object.fromEntries(r.questions.map((q) => [q.questionId, q]))
const ed = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const posOf = new Map(r.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const prog = {}
const P = (name) => (prog[name] ??= (() => { const raw = loadProgram(byName[name]); return { language: raw.language, ix: buildIndex(raw.paras, { stemming: true }) } })())
const hash = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7)
const sets = process.env.SETS ? process.env.SETS.split(',') : ['S', 'D', 'E']
const pack = { meta: { release: version, sha256: r._sha256, retriever: 'V7: BM25 lematizado, consulta = pregunta + contexto + términos del ítem', k: K, expansionsFile: path.basename(expFile), splitMeta: split.meta, generado: sets }, S: [], D: [], E: [] }
const rec = { S: [0, 0, 0], D: [0, 0, 0], E: [0, 0, 0] }
for (const set of sets) for (const c of split[set]) {
  const q = qd[c.questionId], e = ed[c.entityId], px = P(e.name)
  const ex = EXP[c.questionId]; if (!ex?.terms) throw new Error(`Sin expansión para ${c.questionId} (${set}); genérala con el mismo prompt antes de empaquetar`)
  const qt = tokens(q.canonicalText + ' ' + (q.contextText ?? '') + ' ' + ex.terms.join(' '), { stemming: true })
  const ranked = bm25(px.ix, qt, 400)
  const B = ranked.slice(0, K).map((x) => ({ i: x.i, page: px.ix.docs[x.i].page, score: +x.s.toFixed(2), text: px.ix.docs[x.i].text.slice(0, 1200) }))
  const p = posOf.get(c.questionId + '|' + c.entityId); const quotes = (p && usable(p) ? p.evidence ?? [] : []).filter((x) => x.text)
  let A = null, refIdx = null
  if (quotes.length) {
    // La referencia se localiza por la CITA (páginas registradas ±1), nunca por el ranking del recuperador: un párrafo sin términos en común con la consulta (p. ej. idioma distinto) seguiría siendo la evidencia registrada.
    let hit = null, best = 0
    for (const qq of quotes) px.ix.docs.forEach((d, i) => { if (Math.abs(d.page - qq.page) > 1) return; if (!quoteHit(d, qq.text, qq.page)) return; const qt = [...new Set(tokens(qq.text, { stemming: true }).filter((w) => w.length > 3))]; const dt = new Set(tokens(d.text, { stemming: true })); const ov = qt.filter((w) => dt.has(w)).length / (qt.length || 1); if (ov > best) { best = ov; hit = { i } } })
    if (hit) { refIdx = hit.i; const rest = B.filter((b) => b.i !== refIdx).slice(0, K - 1); const ref = { i: refIdx, page: px.ix.docs[refIdx].page, score: null, text: px.ix.docs[refIdx].text.slice(0, 1200) }
      const all = [...rest, ref]; const rnd = rng(hash(c.questionId + c.entityId)); for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [all[k], all[j]] = [all[j], all[k]] }
      A = all.map(({ i, ...x }) => x) }
    rec[set][0]++; if (B.some((b) => quotes.some((qq) => quoteHit(px.ix.docs[b.i], qq.text, qq.page)))) rec[set][1]++; if (!hit) rec[set][2]++
  }
  pack[set].push({ cellId: `${c.questionId}|${c.entityId}`, set, party: e.name, language: px.language, item: q.canonicalText, context: q.contextText ?? '', stratum: c.stratum, passagesB: B.map(({ i, ...x }) => x), passagesA: A, referenceVerified: refIdx !== null, evidence_scope: { B: 'passages_retrieved', A: A ? 'reference_evidence_plus_distractors' : null } })
}
pack.meta.cells = Object.fromEntries(sets.map((s) => [s, pack[s].length]))
pack.meta.coherencia = Object.fromEntries(sets.map((s) => [s, { celdasConCita: rec[s][0], retriever_recall_cita: rec[s][0] ? +(rec[s][1] / rec[s][0]).toFixed(3) : null, citaSinPasajeVerificable: rec[s][2] }]))
write('benchmark_pack.json', pack)
console.log(JSON.stringify(pack.meta.cells), JSON.stringify(pack.meta.coherencia))
