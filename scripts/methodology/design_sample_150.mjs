// Diseño (SOLO CÁLCULO, local) de la muestra de la campaña humana de ~150 celdas con el manual v0.2. No crea ninguna campaña ni toca la BD.
// E SELLADO: este script lee únicamente las preguntas de DESARROLLO (meta.devQuestionIds) y NO carga las celdas de E ni sus preguntas.
//   node scripts/methodology/design_sample_150.mjs
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, ROOT, usable } from './lib.mjs'
const sp = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_split.json'), 'utf8'))
const dev = new Set(sp.meta.devQuestionIds)               // solo desarrollo
const S = new Set(sp.S.map((c) => `${c.questionId}|${c.entityId}`)), D = new Set(sp.D.map((c) => `${c.questionId}|${c.entityId}`))
const r = loadRelease('2.1.2'); const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const lang = Object.fromEntries(PROGRAMS.map((p) => [p.name, p.language]))
const pm = new Map(r.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const regional = (q) => (q.regionalParties ?? []).length > 0
const stratum = (q, e) => { const p = pm.get(q.questionId + '|' + e.entityId); if (!p) return 'sin_fila'; if (!usable(p)) return 'ambigua_o_no_comparable'; if (p.value < 0) return 'negativa'; if (p.value === 0 || p.stanceStatus === 'conditional') return 'neutral_o_condicionada'; return Math.abs(p.value) === 2 ? 'positiva_2' : 'positiva_1' }
const cells = r.questions.filter((q) => dev.has(q.questionId) && !regional(q)).flatMap((q) => r.entities.map((e) => ({ id: `${q.questionId}|${e.entityId}`, party: e.name, dim: q.dimensionName, lang: lang[e.name] ?? '?', stratum: stratum(q, e), S: S.has(`${q.questionId}|${e.entityId}`), D: D.has(`${q.questionId}|${e.entityId}`) })))
const cnt = (arr, k) => arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] ?? 0) + 1), m), {})
const N = cells.length; const touched = JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8')).cells.map((c) => c.cellId)
const frame = cells.filter((c) => !touched.includes(c.id))
const out = { poblacion: { descripcion: 'preguntas de desarrollo no regionales × 19 partidos', preguntas: new Set(cells.map((c) => c.id.split('|')[0])).size, celdas: N, yaTocadasPorPiloto: touched.length, marco: frame.length },
  porEstrato: cnt(frame, 'stratum'), porIdioma: cnt(frame, 'lang'), porDimension: cnt(frame, 'dim'), porPartido: cnt(frame, 'party') }
const pct = (o, n) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v} (${(100 * v / n).toFixed(1)} %)`]))
console.log(JSON.stringify({ ...out, porEstrato: pct(out.porEstrato, frame.length), porIdioma: pct(out.porIdioma, frame.length), porDimension: pct(out.porDimension, frame.length) }, null, 1))
console.log('partidos:', JSON.stringify(out.porPartido))
// semilla de silencio (candidatas) en desarrollo
const sil = path.join(OUT, 'spike', 'silence.json'); if (fs.existsSync(sil)) { const s = JSON.parse(fs.readFileSync(sil, 'utf8')); console.log('celdas sin posición en desarrollo con candidatas BM25 (spike):', s.length) }
// Precisión: semiancho del IC de Wilson 95 % para una proporción
const wilson = (p, n) => { const z = 1.96, d = 1 + z * z / n, c = p + z * z / (2 * n), a = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - a) / d, (c + a) / d] }
const tab = []; for (const n of [20, 45, 60, 105, 150]) tab.push({ n, 'p=0.5': +(((wilson(0.5, n)[1] - wilson(0.5, n)[0]) / 2) * 100).toFixed(1), 'p=0.8': +(((wilson(0.8, n)[1] - wilson(0.8, n)[0]) / 2) * 100).toFixed(1), 'p=0.9': +(((wilson(0.9, n)[1] - wilson(0.9, n)[0]) / 2) * 100).toFixed(1) })
console.log('Semiancho IC95 % (puntos porcentuales):'); console.table(tab)
fs.writeFileSync(path.join(OUT, 'muestra150_marco.json'), JSON.stringify(out, null, 1))
