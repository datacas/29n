// Fase 1 del diseño muestral (LOCAL, determinista, sin modelos): extrae la muestra de la campaña humana de ~150 celdas con el manual v0.2 y fija semillas, estratos, probabilidades de inclusión y pesos.
// E SELLADO: solo se cargan las preguntas de DESARROLLO (meta.devQuestionIds); no se leen las celdas ni las preguntas de E. No llama a modelos; no escribe en la BD.
//   node scripts/methodology/draw_sample_150.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadRelease, OUT, ROOT, usable, rng } from './lib.mjs'
import { systematic, replacements, inclusion, kishNeff } from './sampling.mjs'

const SEEDS = { positiva_2: 150101, positiva_1: 150102, negativa: 150103, sin_fila: 150104, repeticion: 150105, orden: 150106 }
const ALLOC = { positiva_2: 17, negativa: 20, sin_fila: 45, R_total: 105, T1: 20, T_reserva: 4, repeticion: 15 }   // positiva_1 y el censo de neutral/ambigua se ajustan a 105
const sp = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8'))
const dev = new Set(sp.meta.devQuestionIds)
const keyOf = (c) => `${c.questionId}|${c.entityId}`
const Sset = new Set(sp.S.map(keyOf))
const pilot = new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8')).cells.map((c) => c.cellId))
const r = loadRelease('2.1.2'); const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const lang = Object.fromEntries(PROGRAMS.map((p) => [p.name, p.language]))
const pm = new Map(r.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const regional = (q) => (q.regionalParties ?? []).length > 0
const stratum = (q, e) => { const p = pm.get(q.questionId + '|' + e.entityId); if (!p) return 'sin_fila'; if (!usable(p)) return 'ambigua_o_no_comparable'; if (p.value < 0) return 'negativa'; if (p.value === 0 || p.stanceStatus === 'conditional') return 'neutral_o_condicionada'; return Math.abs(p.value) === 2 ? 'positiva_2' : 'positiva_1' }
const all = r.questions.filter((q) => dev.has(q.questionId) && !regional(q)).flatMap((q) => r.entities.map((e) => ({ id: `${q.questionId}|${e.entityId}`, questionId: q.questionId, entityId: e.entityId, party: e.name, dim: q.dimensionName, lang: lang[e.name] ?? '?', stratum: stratum(q, e) })))
const sRest = all.filter((c) => Sset.has(c.id) && !pilot.has(c.id))                  // T2: certeza de inclusión (tienen codificaciones de IA)
const frame = all.filter((c) => !pilot.has(c.id) && !Sset.has(c.id))               // marco de R: desarrollo − piloto − resto de S
const byStratum = (s) => frame.filter((c) => c.stratum === s).sort((a, b) => a.party.localeCompare(b.party) || a.dim.localeCompare(b.dim) || a.lang.localeCompare(b.lang) || a.id.localeCompare(b.id))
const census = [...byStratum('neutral_o_condicionada'), ...byStratum('ambigua_o_no_comparable')]
const n_h = { positiva_2: ALLOC.positiva_2, negativa: ALLOC.negativa, sin_fila: ALLOC.sin_fila, census: census.length }
n_h.positiva_1 = ALLOC.R_total - n_h.positiva_2 - n_h.negativa - n_h.sin_fila - n_h.census
const R = []; const repl = {}
for (const s of ['positiva_2', 'positiva_1', 'negativa', 'sin_fila']) {
  const cells = byStratum(s); const seed = SEEDS[s]; const idx = systematic(cells.length, n_h[s], seed); const rp = replacements(cells.length, idx); const { pi, weight } = inclusion(cells.length, idx.length)
  for (const i of idx) { R.push({ ...cells[i], sample: 'R', tier: `R-${s}`, stratumSize: cells.length, stratumSampled: idx.length, pi, weight, seed, replacement: rp[i] != null ? cells[rp[i]].id : null }) }
}
for (const c of census) { const nh = census.filter((x) => x.stratum === c.stratum).length; R.push({ ...c, sample: 'R', tier: `R-${c.stratum}`, stratumSize: nh, stratumSampled: nh, pi: 1, weight: 1, seed: null, replacement: null }) }
const Rids = new Set(R.map((c) => c.id))
// T1 (regla preinscrita): celdas sin posición NO elegidas en R, ordenadas por la puntuación BM25 de su mejor candidata (spike de silencio), de mayor a menor, empate por identificador
const sil = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(OUT, 'spike', 'silence.json'), 'utf8')).map((x) => [x.cellId, x.bm25_top1]))
const t1pool = all.filter((c) => c.stratum === 'sin_fila' && !pilot.has(c.id) && !Sset.has(c.id) && !Rids.has(c.id) && (sil[c.id] ?? 0) > 0).sort((a, b) => (sil[b.id] ?? 0) - (sil[a.id] ?? 0) || a.id.localeCompare(b.id))
const T1 = t1pool.slice(0, ALLOC.T1).map((c) => ({ ...c, sample: 'T', tier: 'T1_candidata_omision', bm25_top1: sil[c.id] }))
const Treserve = t1pool.slice(ALLOC.T1, ALLOC.T1 + ALLOC.T_reserva).map((c) => ({ ...c, sample: 'T', tier: 'T_reserva', bm25_top1: sil[c.id] }))
const T2 = sRest.map((c) => ({ ...c, sample: 'T', tier: 'T2_resto_S' }))
// Repetibilidad: 15 celdas de R al azar (semilla propia), preinscritas
const rr = rng(SEEDS.repeticion); const repeat = new Set(R.map((c) => [rr(), c.id]).sort((a, b) => a[0] - b[0]).slice(0, ALLOC.repeticion).map((x) => x[1]))
R.forEach((c) => (c.repeat = repeat.has(c.id)))
const planned = [...R, ...T1, ...T2]
const sampleOrder = (() => { const o = rng(SEEDS.orden); return planned.map((c) => [o(), c.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) })()
const frameHash = crypto.createHash('sha256').update(JSON.stringify({ frame: frame.map((c) => c.id).sort(), sRest: sRest.map((c) => c.id).sort(), seeds: SEEDS, alloc: n_h, R: R.map((c) => c.id), T1: T1.map((c) => c.id), Treserve: Treserve.map((c) => c.id), repeat: [...repeat].sort() })).digest('hex')
const out = { generado: new Date().toISOString(), semillas: SEEDS, asignacion: n_h, marco: { desarrollo: all.length, piloto: pilot.size, restoS: sRest.length, marcoR: frame.length }, designSha256: frameHash, ordenPresentacion: sampleOrder, R, T1, T2, Treserve, repeticion: [...repeat],
  reglas: { reemplazoR: 'Solo por invalidez TÉCNICA (sin texto de programa, <3 pasajes recuperados o pregunta no aplicable), comprobada antes de empezar. El reemplazo es la celda siguiente no elegida del mismo estrato en el orden del muestreo. Nunca por dificultad o resultado.', reservaT: 'Las 4 reservas (siguientes de la regla T1) solo sustituyen a celdas T técnicamente inválidas.', T1: 'sin_fila no elegidas en R, por puntuación BM25 de la mejor candidata (spike de silencio), de mayor a menor; empate por identificador' } }
fs.writeFileSync(path.join(OUT, 'h150', 'sample_draw.json'), JSON.stringify(out, null, 1))
const cnt = (a, k) => a.reduce((m, x) => ((m[x[k]] = (m[x[k]] ?? 0) + 1), m), {})
console.log(JSON.stringify({ marco: out.marco, asignacionR: n_h, nR: R.length, nT1: T1.length, nT2: T2.length, nReservaT: Treserve.length, planificadas: planned.length, repeticion: repeat.size, sha: frameHash.slice(0, 12) }))
console.log('R por estrato:', JSON.stringify(cnt(R, 'tier'))); console.log('R por idioma:', JSON.stringify(cnt(R, 'lang'))); console.log('R por dimensión:', JSON.stringify(cnt(R, 'dim')))
const parties = cnt(R, 'party'); console.log('R por partido:', JSON.stringify(parties), '| partidos sin celdas en R:', r.entities.filter((e) => !parties[e.name]).map((e) => e.name).join(',') || 'ninguno')
console.log('pesos por estrato:', JSON.stringify(Object.fromEntries([...new Set(R.map((c) => c.tier))].map((t) => [t, { N: R.find((c) => c.tier === t).stratumSize, n: R.filter((c) => c.tier === t).length, pi: +R.find((c) => c.tier === t).pi.toFixed(4), w: +R.find((c) => c.tier === t).weight.toFixed(2) }]))))
console.log('n efectivo de Kish (R):', kishNeff(R.map((c) => c.weight)).toFixed(1), 'de', R.length, '| T1 bm25 min/max:', Math.min(...T1.map((c) => c.bm25_top1)).toFixed(1), Math.max(...T1.map((c) => c.bm25_top1)).toFixed(1))
