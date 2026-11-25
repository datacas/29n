// Fase 1 · Diagnóstico de la recuperación de pasajes (determinista, sin modelos, solo preguntas de DESARROLLO).
// El conjunto E y sus preguntas quedan fuera: no se usan para ajustar el recuperador.
// «Recall» se mide contra la cita REGISTRADA (de Claude/revisión editorial): referencia útil pero NO independiente ni prueba de
// que esa cita sea la evidencia suficiente. Se informan por separado recall de página y recall de la cita (solapamiento de términos).
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, usable, OUT, ROOT, write, pct } from './lib.mjs'
import { tokens, loadProgram, windows, buildIndex, bm25, prf, rrf, quoteHit } from './retrieval.mjs'

const version = process.argv[2] ?? '2.1.2'
const r = loadRelease(version)
const split = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8'))
const dev = new Set(split.meta.devQuestionIds)
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts'))
const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p]))
const Q = Object.fromEntries(r.questions.map((q) => [q.questionId, q]))
const E = Object.fromEntries(r.entities.map((e) => [e.entityId, e]))
const KS = [6, 8, 10, 15, 20]
const expFile = path.join(OUT, 'expansions_dev.json')
const EXP = fs.existsSync(expFile) ? JSON.parse(fs.readFileSync(expFile, 'utf8')) : {}
const expQ = (c) => (EXP[c.q.questionId]?.terms ?? []).join(' ')
const POS = ['impulsar', 'aumentar', 'garantizar', 'crear', 'ampliar', 'reforzar', 'defender', 'apoyar', 'promover', 'fomentar']
const NEG = ['rechazar', 'oponer', 'derogar', 'eliminar', 'suprimir', 'prohibir', 'reducir', 'limitar', 'suspender', 'reformar']

// ---- celdas de referencia (R): preguntas de desarrollo, no regionales, posición utilizable con cita registrada
const R = r.positions.filter((p) => usable(p) && dev.has(p.questionId) && (p.evidence?.length ?? 0) > 0).map((p) => ({ p, q: Q[p.questionId], e: E[p.entityId], quotes: p.evidence.map((x) => ({ text: x.text, page: x.page })) }))
const haveExp = Object.values(EXP).some((x) => x.terms)
const Rall = R.length
for (let i = R.length - 1; i >= 0 && haveExp; i--) if (!EXP[R[i].q.questionId]?.terms) R.splice(i, 1)
const NOROW = []
{ const has = new Set(r.positions.map((p) => p.questionId + '|' + p.entityId)); for (const qid of dev) for (const e of r.entities) if (!has.has(qid + '|' + e.entityId)) NOROW.push({ q: Q[qid], e }) }
const partyCov = {}; for (const p of r.positions.filter(usable)) partyCov[p.entityId] = (partyCov[p.entityId] ?? 0) + 1

// ---- índices por partido
const prog = {}
function P(name) {
  if (prog[name]) return prog[name]
  const raw = loadProgram(byName[name]); const win = windows(raw.paras, 2)
  return (prog[name] = { language: raw.language, pages: raw.pages, para0: buildIndex(raw.paras, { stemming: false }), paraS: buildIndex(raw.paras, { stemming: true }), winS: buildIndex(win, { stemming: true }) })
}
const stemQ = (s) => tokens(s, { stemming: true }), plainQ = (s) => tokens(s, { stemming: false })
const VARIANTS = {
  V0_base: { desc: 'párrafos, sin lematizar, consulta = pregunta', run: (px, c) => ({ ix: px.para0, list: bm25(px.para0, plainQ(c.q.canonicalText), 200), qt: plainQ(c.q.canonicalText) }) },
  V1_lemas: { desc: 'párrafos, lematización ligera, consulta = pregunta', run: (px, c) => ({ ix: px.paraS, list: bm25(px.paraS, stemQ(c.q.canonicalText), 200), qt: stemQ(c.q.canonicalText) }) },
  V2_contexto: { desc: 'V1 + texto explicativo en la consulta', run: (px, c) => { const qt = stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? '')); return { ix: px.paraS, list: bm25(px.paraS, qt, 200), qt } } },
  V3_prf: { desc: 'V2 + realimentación por pseudo-relevancia (6 términos)', run: (px, c) => { const qt = stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? '')); const b = bm25(px.paraS, qt, 200); const q2 = prf(px.paraS, qt, b); return { ix: px.paraS, list: bm25(px.paraS, q2, 200), qt: q2 } } },
  V4_ventana2: { desc: 'V2 sobre ventanas de 2 párrafos (contexto adyacente)', run: (px, c) => { const qt = stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? '')); return { ix: px.winS, list: bm25(px.winS, qt, 200), qt } } },
  V5_dual: { desc: 'V2 con dos consultas (verbos a favor / en contra) fusionadas por RRF', run: (px, c) => { const base = c.q.canonicalText + ' ' + (c.q.contextText ?? ''); const a = stemQ(base + ' ' + POS.join(' ')), b = stemQ(base + ' ' + NEG.join(' ')); const f = rrf([bm25(px.paraS, a, 200), bm25(px.paraS, b, 200)], 200); return { ix: px.paraS, list: f.map((x) => ({ i: x.i, s: x.s })), qt: stemQ(base) } } },
  V6_ventana_prf: { desc: 'V4 + realimentación por pseudo-relevancia', run: (px, c) => { const qt = stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? '')); const b = bm25(px.winS, qt, 200); const q2 = prf(px.winS, qt, b); return { ix: px.winS, list: bm25(px.winS, q2, 200), qt: q2 } } },
}
if (Object.values(EXP).some((x) => x.terms)) {
  VARIANTS.V7_expansion = { desc: 'V2 + sinónimos/vocabulario generados por un modelo gratuito por ítem', run: (px, c) => { const qt = stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? '') + ' ' + expQ(c)); return { ix: px.paraS, list: bm25(px.paraS, qt, 200), qt } } }
  VARIANTS.V8_expansion_ventana = { desc: 'V4 + expansión por ítem', run: (px, c) => { const qt = stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? '') + ' ' + expQ(c)); return { ix: px.winS, list: bm25(px.winS, qt, 200), qt } } }
}
const hitOf = (ix, i, c) => c.quotes.some((q) => quoteHit(ix.docs[i], q.text, q.page))
const pageOf = (ix, i, c) => c.quotes.some((q) => (ix.docs[i].pages ?? [ix.docs[i].page]).some((pg) => Math.abs(pg - q.page) <= 1))
const matched = (ix, i, qt) => new Set(qt).size && [...new Set(qt)].filter((w) => ix.tf[i].has(w)).length

const results = {}, perCell = {}
for (const [vn, v] of Object.entries(VARIANTS)) {
  const acc = Object.fromEntries(KS.map((k) => [k, { page: 0, hit: 0, prec: 0, tok: 0, noise: 0, n: 0 }])); let mrr = 0
  perCell[vn] = R.map((c) => {
    const { ix, list, qt } = v.run(P(c.e.name), c)
    const firstHit = list.findIndex((x) => hitOf(ix, x.i, c)); if (firstHit >= 0 && firstHit < 20) mrr += 1 / (firstHit + 1)
    for (const k of KS) { const top = list.slice(0, k), a = acc[k]; a.n++; if (top.some((x) => pageOf(ix, x.i, c))) a.page++; if (top.some((x) => hitOf(ix, x.i, c))) a.hit++; a.prec += top.length ? top.filter((x) => hitOf(ix, x.i, c)).length / top.length : 0; a.tok += top.reduce((s, x) => s + ix.docs[x.i].text.length / 4, 0); a.noise += top.length ? top.filter((x) => matched(ix, x.i, qt) < 2).length / top.length : 0 }
    return { firstHit: firstHit < 0 ? null : firstHit + 1 }
  })
  results[vn] = { desc: v.desc, mrr: +(mrr / R.length).toFixed(3), byK: Object.fromEntries(KS.map((k) => { const a = acc[k]; return [k, { recallPagina: +(a.page / a.n).toFixed(3), recallCita: +(a.hit / a.n).toFixed(3), precisionCita: +(a.prec / a.n).toFixed(3), tokensMedios: Math.round(a.tok / a.n), ruidoLexico: +(a.noise / a.n).toFixed(3) }] })) }
}
// ---- mejor variante a K=10 por recallCita (desempate: menos tokens)
const best = Object.entries(results).sort((a, b) => b[1].byK[10].recallCita - a[1].byK[10].recallCita || a[1].byK[10].tokensMedios - b[1].byK[10].tokensMedios)[0][0]

// ---- análisis de fallos con la mejor variante a K=20 y estratos
const strat = {}
const bump = (g, k, hit) => { const o = ((strat[g] ??= {})[k] ??= { n: 0, hit: 0 }); o.n++; if (hit) o.hit++ }
const covSorted = Object.values(partyCov).sort((a, b) => a - b); const t1 = covSorted[Math.floor(covSorted.length / 3)], t2 = covSorted[Math.floor((2 * covSorted.length) / 3)]
const misses = []
R.forEach((c, n) => {
  const fh = perCell[best][n].firstHit; const hit10 = fh !== null && fh <= 10
  bump('signo', c.p.value > 0 ? 'positiva' : 'negativa', hit10); bump('intensidad', Math.abs(c.p.value) === 2 ? '±2' : '±1', hit10)
  bump('idioma', P(c.e.name).language, hit10); const cv = partyCov[c.e.entityId]; bump('cobertura del partido', cv <= t1 ? 'baja' : cv <= t2 ? 'media' : 'alta', hit10)
  bump('dimensión', c.q.dimensionCode, hit10)
  if (fh === null || fh > 20) misses.push({ c, rank: fh })
})
const causes = {}
for (const { c, rank } of misses) {
  const px = P(c.e.name); const q0 = c.quotes[0]
  const pageText = [q0.page - 1, q0.page, q0.page + 1].map((p) => px.pages[p - 1] ?? '').join(' ')
  const qt = [...new Set(tokens(q0.text, { stemming: true }).filter((w) => w.length > 3))]; const pt = new Set(tokens(pageText, { stemming: true }))
  const inText = qt.length ? qt.filter((w) => pt.has(w)).length / qt.length : 0
  const shared = qt.filter((w) => new Set(stemQ(c.q.canonicalText + ' ' + (c.q.contextText ?? ''))).has(w)).length
  const winHit = (() => { const { ix, list } = VARIANTS.V4_ventana2.run(px, c); return list.slice(0, 20).some((x) => hitOf(ix, x.i, c)) })()
  const cause = inText < 0.6 ? 'la cita no aparece en el texto extraído (extracción/OCR/idioma de la cita)' : winHit ? 'segmentación: la cita se parte entre párrafos (sí aparece con ventana de 2)' : shared < 2 ? 'vocabulario: la cita comparte <2 términos con la pregunta' : rank ? `mal ordenada: el primer acierto está en el puesto ${rank}` : 'otras'
  const key = cause.startsWith('mal ordenada') ? 'mal ordenada (puesto >20)' : cause
  causes[key] = (causes[key] ?? 0) + 1
}
// ---- celdas sin posición: ¿hay candidatos recuperables?
const scoreTop = (list) => (list[0]?.s ?? 0)
const coded = R.map((c) => scoreTop(VARIANTS[best].run(P(c.e.name), c).list)).sort((a, b) => a - b); const med = coded[Math.floor(coded.length / 2)], p25 = coded[Math.floor(coded.length / 4)]
const nr = NOROW.filter((x) => byName[x.e.name]).map((x) => scoreTop(VARIANTS[best].run(P(x.e.name), { q: x.q, e: x.e, quotes: [] }).list)).sort((a, b) => a - b)
const noRow = { celdas: nr.length, medianaTop1: +nr[Math.floor(nr.length / 2)].toFixed(1), medianaTop1Codificadas: +med.toFixed(1), p25Top1Codificadas: +p25.toFixed(1), conTop1SuperiorAlP25Codificadas: nr.filter((s) => s >= p25).length, conTop1SuperiorALaMedianaCodificadas: nr.filter((s) => s >= med).length, nota: 'Puntuaciones BM25 (no comparables entre consultas de longitud distinta); señal orientativa de celdas sin posición con texto léxicamente cercano. NO prueba que haya omisiones.' }
const fin = (o) => Object.fromEntries(Object.entries(o).map(([g, v]) => [g, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { n: x.n, recallCita_K10: +(x.hit / x.n).toFixed(3) }]))]))

const meta = { celdasRSinFiltrarPorExpansion: Rall, release: version, sha256: r._sha256, referencia: 'cita registrada (NO independiente)', celdasR: R.length, preguntasDesarrollo: dev.size, excluido: 'conjunto E y sus 84 preguntas de evaluación', mejorVariante: best }
write('retrieval_diag.json', { meta, variantes: results, estratosK10_mejorVariante: fin(strat), fallosK20: { n: misses.length, causas: causes }, celdasSinPosicion: noRow })
const tb = Object.entries(results).map(([k, v]) => `| ${k} | ${v.desc} | ${KS.map((kk) => `${pct(v.byK[kk].recallCita)}`).join(' / ')} | ${KS.map((kk) => pct(v.byK[kk].recallPagina)).join(' / ')} | ${v.byK[10].tokensMedios} | ${pct(v.byK[10].precisionCita)} | ${pct(v.byK[10].ruidoLexico)} | ${v.mrr} |`).join('\n')
write('retrieval_diag.md', `# Diagnóstico de recuperación — release ${version} (solo desarrollo; E excluido)\n\nCeldas de referencia: ${R.length} (posición utilizable con cita registrada, ${dev.size} preguntas de desarrollo). Referencia = cita registrada, no independiente.\n\n| Variante | Descripción | Recall de la cita K=6/8/10/15/20 | Recall de página ±1 | Tokens K=10 | Precisión K=10 | Ruido K=10 | MRR |\n|---|---|---|---|---|---|---|---|\n${tb}\n\nMejor variante (recall de la cita a K=10): **${best}**.\n\n## Fallos a K=20 (${misses.length} de ${R.length})\n${Object.entries(causes).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n## Recall de la cita a K=10 por estrato (${best})\n${Object.entries(fin(strat)).map(([g, v]) => `- **${g}**: ${Object.entries(v).map(([k, x]) => `${k} ${pct(x.recallCita_K10)} (n=${x.n})`).join('; ')}`).join('\n')}\n\n## Celdas sin posición\n${JSON.stringify(noRow)}\n`)
console.log(`R=${R.length} mejor=${best}`); console.log(tb.replace(/\|/g, ' ').slice(0, 1800)); console.log(JSON.stringify(causes)); console.log(JSON.stringify(noRow))
