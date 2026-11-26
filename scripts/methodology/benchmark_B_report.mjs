// Informe específico de la modalidad B (solo lectura de los JSONL; resultados LOCALES): comparación A→B, celdas con la cita no recuperada, celdas sin posición,
// selección pre-registrada aplicada A POSTERIORI a los evaluadores con cobertura completa, y discrepancias prioritarias para adjudicación humana.
// Referencia = codificación registrada (provisional). not_mentioned = ausencia en los pasajes dados, no en el programa.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, rng, write } from './lib.mjs'
const load = (f) => fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens))
const A = load('benchmark_S_A.jsonl'), B = load('benchmark_S_B.jsonl')
const pk = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8')); const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const FULL = ['llama-4-scout', 'codex-gpt-6.2-sol', 'minimax-m3.1-flash']      // evaluadores con cobertura casi completa en B (≥ 74 de 80)
const refCls = (id) => { const p = pm.get(id); if (!p || p.value === null || p.value === undefined) return null; return p.value === 0 ? 'explicit_neutral' : p.value > 0 ? 'supports' : 'opposes' }
const first = (recs) => { const m = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!m[k] || r.repeat < m[k].repeat) m[k] = r } return m }
const fa = first(A), fb = first(B); const labels = [...new Set(B.map((r) => r.evaluator_label))]
const cells = pk.S; const flat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const cited = (c) => { const q = pm.get(c.cellId)?.evidence?.[0]?.text; if (!q) return null; const w = flat(q).split(' ').filter((x) => x.length > 3); const all = flat(c.passagesB.map((p) => p.text).join(' ')); return w.length > 0 && w.filter((x) => all.includes(x)).length / w.length >= 0.8 }
const out = { evaluadoresCompletos: FULL, nota: 'Referencia provisional; resultados locales.' }
// 1) A → B por evaluador, en las 28 celdas con referencia
out.A_vs_B = {}
for (const L of FULL) { let n = 0, agA = 0, agB = 0, cambia = 0, intCambia = 0; for (const c of cells) { const ref = refCls(c.cellId); if (!ref) continue; const a = fa[c.cellId + '|' + L], b = fb[c.cellId + '|' + L]; if (!a || !b) continue; n++; if (a.document_class === ref) agA++; if (b.document_class === ref) agB++; if (a.document_class !== b.document_class) cambia++; else if (a.intensity !== b.intensity) intCambia++ }
  out.A_vs_B[L] = { celdas: n, claseIgualRef_A: n ? +(agA / n).toFixed(3) : null, claseIgualRef_B: n ? +(agB / n).toFixed(3) : null, celdasQueCambianDeClase: cambia, celdasQueCambianSoloDeIntensidad: intCambia } }
// 2) celdas con la cita registrada NO recuperada
out.citaNoRecuperada = cells.filter((c) => cited(c) === false).map((c) => ({ cellId: c.cellId, partido: c.party, referencia: refCls(c.cellId), respuestas: Object.fromEntries(FULL.map((L) => [L, fb[c.cellId + '|' + L]?.document_class ?? null])) }))
out.resumenCitaNoRecuperada = { celdas: out.citaNoRecuperada.length, evaluadoresConNotMentioned: out.citaNoRecuperada.reduce((a, c) => a + Object.values(c.respuestas).filter((x) => x === 'not_mentioned').length, 0), respuestasTotales: out.citaNoRecuperada.reduce((a, c) => a + Object.values(c.respuestas).filter(Boolean).length, 0) }
// 3) celdas sin posición registrada (12)
const sin = cells.filter((c) => !pm.get(c.cellId)); out.sinPosicion = sin.map((c) => { const r = Object.fromEntries(FULL.map((L) => [L, fb[c.cellId + '|' + L]?.document_class ?? null])); const pos = Object.values(r).filter((x) => x === 'supports' || x === 'opposes'); return { cellId: c.cellId, partido: c.party, respuestas: r, posibleOmision: pos.length >= 2 } })
out.resumenSinPosicion = { celdas: sin.length, todasNotMentioned: out.sinPosicion.filter((c) => Object.values(c.respuestas).filter(Boolean).every((x) => x === 'not_mentioned')).length, dosOMasConPosicion: out.sinPosicion.filter((c) => c.posibleOmision).length, algunaPosicionOAmbigua: out.sinPosicion.filter((c) => Object.values(c.respuestas).some((x) => ['supports', 'opposes', 'ambiguous', 'explicit_neutral'].includes(x))).length }
// 4) selección pre-registrada aplicada a posteriori (evaluadores completos)
const all = {}; for (const r of B.filter((r) => FULL.includes(r.evaluator_label))) (all[r.cellId] ??= []).push(r.document_class)
const disc = [], unan = []; for (const [id, cl] of Object.entries(all)) { const set = new Set(cl); const sg = new Set(cl.filter((x) => x === 'supports' || x === 'opposes')); (set.size > 1 || sg.size > 1 ? disc : unan).push(id) }
const rand = rng(29); const aud = unan.filter(() => rand() < 0.25)
out.seleccionPreRegistrada = { celdas: Object.keys(all).length, discrepantes: disc.length, unanimes: unan.length, auditoriaAleatoria25: aud.length, seleccionadas: disc.length + aud.length }
// 5) discrepancias prioritarias para adjudicación humana
const prio = []; for (const c of cells) { const ref = refCls(c.cellId); const cl = FULL.map((L) => fb[c.cellId + '|' + L]?.document_class).filter(Boolean); const set = new Set(cl); const sg = new Set([...cl, ref].filter((x) => x === 'supports' || x === 'opposes'))
  const motivos = []; if (sg.size > 1) motivos.push('signo opuesto entre evaluadores o con la referencia'); if (set.size > 1) motivos.push('clase distinta entre evaluadores'); if (ref && cl.length && cl.filter((x) => x !== ref).length / cl.length >= 0.5) motivos.push('la mayoría difiere de la referencia'); if (cited(c) === false) motivos.push('cita registrada no recuperada')
  if (motivos.length) prio.push({ cellId: c.cellId, partido: c.party, referencia: ref, respuestas: cl, motivos }) }
out.prioridadAdjudicacion = prio; out.resumenPrioridad = { celdas: prio.length, conSignoOpuesto: prio.filter((p) => p.motivos[0]?.startsWith('signo')).length }
write('benchmark_B_informe.json', out)
console.log(JSON.stringify({ A_vs_B: out.A_vs_B, citaNoRecuperada: out.resumenCitaNoRecuperada, sinPosicion: out.resumenSinPosicion, seleccionPreRegistrada: out.seleccionPreRegistrada, prioridad: out.resumenPrioridad }, null, 1))
