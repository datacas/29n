// Comprobaciones DETERMINISTAS de calidad del banco de preguntas (release 2.1.2). LOCAL, sin modelos de lenguaje, reproducible (semilla fija). No escribe en la BD ni modifica el banco.
//  1 poder discriminante por pregunta · 2 influencia en el ranking (quitar una pregunta cada vez, con usuarios sintéticos) · 3 estructura y legibilidad · 4 solape léxico (el solape semántico lo añade item_overlap.py)
//   node scripts/methodology/item_quality_checks.mjs
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, usable, rng, OUT, ROOT } from './lib.mjs'
const r = loadRelease('2.1.2'); const Q = r.questions; const SEED = 29
const qd = Object.fromEntries(Q.map((q) => [q.questionId, q])); const ents = r.entities.map((e) => e.entityId); const base = r.positions.filter(usable)
const by = {}; for (const p of base) (by[p.questionId] ??= []).push(p)
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1); const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) }
// 1) Poder discriminante
const disc = Q.map((q, i) => { const ps = by[q.questionId] ?? []; const v = ps.map((p) => p.value); const pos = v.filter((x) => x > 0).length, neg = v.filter((x) => x < 0).length; const maj = Math.max(pos, neg) / ((pos + neg) || 1)
  return { n: i + 1, id: q.questionId, dim: q.dimensionName, partidos: ps.length, media: +mean(v).toFixed(2), sd: +sd(v).toFixed(2), positivas: pos, negativas: neg, unanimidadDeSigno: pos + neg >= 5 && maj >= 0.9, sinContraste: ps.length < 2, regional: (q.regionalParties ?? []).length > 0 } })
const D = { preguntas: Q.length, conAlMenos2Partidos: disc.filter((d) => d.partidos >= 2).length, sinContraste: disc.filter((d) => d.sinContraste).length, unanimidadDeSigno: disc.filter((d) => d.unanimidadDeSigno).length, partidosPorPregunta: { mediana: [...disc.map((d) => d.partidos)].sort((a, b) => a - b)[Math.floor(Q.length / 2)], max: Math.max(...disc.map((d) => d.partidos)) }, sdMedia: +mean(disc.filter((d) => d.partidos >= 3).map((d) => d.sd)).toFixed(2) }
// 2) Influencia en el ranking (réplica de la fórmula de app/lib/scoring/calculate.ts; usuarios SINTÉTICOS)
const regional = new Set(Q.filter((q) => (q.regionalParties ?? []).length).map((q) => q.questionId)); const holders = {}; for (const p of base) (holders[p.questionId] ??= new Set()).add(p.entityId)
const pool = Q.filter((q) => !regional.has(q.questionId) && (holders[q.questionId]?.size ?? 0) >= 2).map((q) => q.questionId); const clip = (v) => Math.max(-2, Math.min(2, v))
function score(ans, skip) { const acc = {}; for (const p of base) { if (p.questionId === skip || !(p.questionId in ans)) continue; const d = qd[p.questionId].dimensionCode; const w = (acc[p.entityId] ??= {}); const o = (w[d] ??= { s: 0, n: 0 }); o.s += 1 - Math.abs(ans[p.questionId] - p.value) / 4; o.n++ }
  const out = {}; for (const e of ents) { const dd = acc[e]; if (!dd) { out[e] = null; continue } const ks = Object.keys(dd); out[e] = (100 * ks.reduce((a, k) => a + dd[k].s / dd[k].n, 0)) / ks.length } return out }
const rank = (s) => ents.filter((e) => s[e] !== null).sort((a, b) => s[b] - s[a] || (a < b ? -1 : 1))
const tau = (a, b) => { const m = a.filter((x) => b.includes(x)); let c = 0, d = 0; for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) (b.indexOf(m[i]) < b.indexOf(m[j]) ? c++ : d++); return c + d ? (c - d) / (c + d) : 1 }
const rand = rng(SEED); const sample = (arr, k) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, k) }
const byParty = {}; for (const p of base) (byParty[p.entityId] ??= {})[p.questionId] = p.value
const USERS = []; for (let i = 0; i < 300; i++) USERS.push(i % 2 ? Object.fromEntries(sample(pool, 30).map((q) => [q, [-2, -1, 1, 2][Math.floor(rand() * 4)]])) : (() => { const e = ents[Math.floor(rand() * ents.length)]; const own = Object.keys(byParty[e] ?? {}).filter((q) => pool.includes(q)); return Object.fromEntries(sample(own, Math.min(30, own.length)).map((q) => [q, clip(byParty[e][q] + (rand() < 0.15 ? (rand() < 0.5 ? -1 : 1) : 0))])) })())
const baseRanks = USERS.map((u) => rank(score(u, null))); const infl = []
for (const q of pool) { let t = 0, ch = 0, n = 0; USERS.forEach((u, i) => { if (!(q in u)) return; const rk = rank(score(u, q)); t += tau(baseRanks[i], rk); if (rk[0] !== baseRanks[i][0]) ch++; n++ }); if (n >= 10) infl.push({ id: q, n: qd[q].dim ?? 0, usuarios: n, tauMedio: +(t / n).toFixed(4), cambia1o: +(ch / n).toFixed(4) }) }
infl.sort((a, b) => a.tauMedio - b.tauMedio)
const I = { usuariosSinteticos: USERS.length, preguntasEvaluadas: infl.length, tauMedioMin: infl[0]?.tauMedio, tauMedioMediana: infl[Math.floor(infl.length / 2)]?.tauMedio, cambia1oMax: Math.max(...infl.map((x) => x.cambia1o)), cambia1oMediana: [...infl.map((x) => x.cambia1o)].sort((a, b) => a - b)[Math.floor(infl.length / 2)], masInfluyentes: infl.slice(0, 5).map((x) => ({ id: x.id, tau: x.tauMedio, cambia1o: x.cambia1o })) }
// 3) Estructura y legibilidad (Fernández-Huerta aproximado)
const syl = (w) => Math.max(1, (w.toLowerCase().match(/[aeiouáéíóúü]+/g) ?? []).length); const NEG = /\b(no|sin|nunca|ningún|ninguna|nadie|tampoco)\b/gi
const struct = Q.map((q, i) => { const t = q.canonicalText; const w = t.split(/\s+/).filter(Boolean); const s = Math.max(1, (t.match(/[.?!¿]+/g) ?? []).length / 2 || 1); const sy = w.reduce((a, x) => a + syl(x), 0)
  const fh = 206.84 - 60 * (sy / w.length) - 1.02 * (w.length / s); const cw = (q.contextText ?? '').split(/\s+/).filter(Boolean).length
  return { n: i + 1, id: q.questionId, palabras: w.length, fh: +fh.toFixed(1), negaciones: (t.match(NEG) ?? []).length, conj: (t.match(/\b(y|e|o|u|ni)\b/gi) ?? []).length, largo: w.length > 28, dobleNegacion: (t.match(NEG) ?? []).length >= 2, contextoPalabras: cw, sinContexto: cw === 0, answerType: q.answerType } })
const S = { preguntas: Q.length, palabrasMediana: [...struct.map((x) => x.palabras)].sort((a, b) => a - b)[Math.floor(Q.length / 2)], largas: struct.filter((x) => x.largo).length, fhMediana: [...struct.map((x) => x.fh)].sort((a, b) => a - b)[Math.floor(Q.length / 2)], fhBajo: struct.filter((x) => x.fh < 40).length, dobleNegacion: struct.filter((x) => x.dobleNegacion).length, sinContexto: struct.filter((x) => x.sinContexto).length, conConjuncion: struct.filter((x) => x.conj >= 1).length, tiposDeRespuesta: struct.reduce((m, x) => ((m[x.answerType] = (m[x.answerType] ?? 0) + 1), m), {}) }
// 4) Solape léxico (Jaccard de lemas ligeros)
const STOP = new Set('de la el los las un una y o en a que se del al por para con sin su sus lo le es debe deben deberia como mas ser'.split(' ')); const stem = (w) => w.replace(/(aciones|acion|amientos|amiento|idades|idad|mente|ando|iendo|ados|adas|idos|idas|ado|ada|ido|ida|ares|eres|ires|ar|er|ir|es|os|as|s)$/, '')
const toks = Q.map((q) => new Set(q.canonicalText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)).map(stem)))
const lex = []; for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) { const a = toks[i], b = toks[j]; const inter = [...a].filter((x) => b.has(x)).length; const jac = inter / (a.size + b.size - inter || 1); if (jac >= 0.5 && inter >= 3) lex.push({ a: i + 1, b: j + 1, jaccard: +jac.toFixed(2) }) }
const L = { paresConSolapeLexico: lex.length, maximo: lex.length ? Math.max(...lex.map((x) => x.jaccard)) : 0 }
const out = { generado: new Date().toISOString(), release: '2.1.2', semilla: SEED, discriminacion: D, influenciaRanking: I, estructura: S, solapeLexico: L, detalle: { discriminacion: disc, influencia: infl, estructura: struct, pares: lex } }
fs.writeFileSync(path.join(OUT, 'calidad_items.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify({ discriminacion: D, influenciaRanking: I, estructura: S, solapeLexico: L }, null, 1))
