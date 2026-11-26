// Análisis LOCAL de la campaña humana de 150 celdas (manual v0.2). Estimaciones con el DISEÑO (pesos, N_h, n_h, corrección de población finita), R y T por separado; no llama a modelos ni escribe en la BD.
// PROCEDENCIA: se lee de eval_provenance; mientras no sea `human_verified`, el informe lo dice en la cabecera y las cifras son PROVISIONALES.
// LIMITACIONES: un único evaluador humano interno; referencia provisional (concordancia, no exactitud); marco = preguntas de desarrollo; humano–IA solo en T2 (n≈21).
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { loadRelease, OUT, ROOT, rng } from './lib.mjs'
import { stratifiedProportion, kishNeff } from './sampling.mjs'
import { krippendorffAlpha, weightedKappa, gwetAC } from '../../app/lib/methodology/agreement.ts'
const POS = ['supports', 'opposes', 'explicit_neutral']
const CATS_C = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous'], CATS_I = [-2, -1, 0, 1, 2]
const nz = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null); const pc = (x) => (x == null ? '—' : (100 * x).toFixed(1) + ' %')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows: camp } = await pool.query(`SELECT id, name FROM eval_campaigns WHERE name LIKE 'Campaña humana%' ORDER BY created_at DESC LIMIT 1`)
const { rows: prov } = await pool.query(`SELECT DISTINCT ON (scope) scope, provenance, statement FROM eval_provenance WHERE campaign_id = $1 ORDER BY scope, recorded_at DESC`, [camp[0].id])
const PROV = (prov.find((x) => x.scope === 'evaluation') ?? prov.find((x) => x.scope === 'all'))?.provenance ?? 'unverified'
const { rows } = await pool.query(`
  SELECT c.ord, c.question_id||'|'||c.entity_id AS id, c.party_name AS party, d.sample, d.tier, d.stratum, d.stratum_size AS "N", d.stratum_sampled AS n, d.weight, d.repeat_selected AS repeat,
         p.document_class AS cls, p.intensity AS int, p.insufficient_context AS ins, p.rationale
    FROM eval_cells c JOIN eval_sample_design d ON d.cell_id = c.id
    JOIN position_codings p ON p.campaign_id = c.campaign_id AND p.question_id = c.question_id AND p.entity_id = c.entity_id AND p.evaluator_kind = 'human' WHERE c.campaign_id = $1 ORDER BY c.ord`, [camp[0].id])
const { rows: aiRows } = await pool.query(`SELECT DISTINCT ON (question_id, entity_id, evaluator_label) question_id||'|'||entity_id AS id, evaluator_label AS label, document_class AS cls, intensity AS int
  FROM position_codings WHERE evaluator_kind = 'ai' AND execution_status = 'ok' AND NOT fallback_used AND config->>'modality' = 'B' ORDER BY question_id, entity_id, evaluator_label, (config->>'repeat')::int NULLS LAST`); await pool.end()
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const fin = JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'sample_final.json'), 'utf8')); const flag = Object.fromEntries(fin.cells.map((c) => [c.id, c.registrada?.citaEnRecuperado ?? null]))
const refOf = (id) => { const p = pm.get(id); if (!p) return { cls: 'sin_posicion', int: null }; if (p.value == null) return { cls: 'ambiguous', int: null }; return { cls: p.value > 0 ? 'supports' : p.value < 0 ? 'opposes' : 'explicit_neutral', int: p.value } }
const H = rows.map((r) => ({ ...r, ref: refOf(r.id), hcls: r.ins && !r.cls ? 'contexto_insuficiente' : r.cls, citaRecuperada: flag[r.id] ?? null }))
const R = H.filter((x) => x.sample === 'R'), T = H.filter((x) => x.sample === 'T')
const strataOf = (arr, f) => { const by = {}; for (const x of arr) { const k = x.tier; by[k] ??= { N: x.N, n: x.n, x: 0, seen: 0 }; by[k].seen++; if (f(x)) by[k].x++ } return Object.values(by) }
const est = (arr, f) => { const s = strataOf(arr, f); const r = stratifiedProportion(s); return { ...r, p: nz(r.p), lo: nz(r.lo), hi: nz(r.hi), neff: nz(kishNeff(arr.map((x) => x.weight))) } }
const out = { generado: new Date().toISOString(), campana: camp[0].name, procedencia: PROV, evaluadas: H.length, R: R.length, T: T.length }
// 1) Distribución de la clase en el marco de R (1.024 celdas), con pesos
const classes = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous', 'contexto_insuficiente']
out.distribucionMarcoR = Object.fromEntries(classes.map((c) => [c, est(R, (x) => x.hcls === c)]))
out.posicionEncontradaMarcoR = est(R, (x) => ['supports', 'opposes', 'explicit_neutral'].includes(x.hcls))
// 2) Celdas CON posición registrada (submarco P): concordancia con la referencia
const RP = R.filter((x) => x.tier !== 'R-sin_fila'), RN = R.filter((x) => x.tier === 'R-sin_fila')   // submarcos por ESTRATO de diseño (N_P = 433, N_sin_fila = 591)
const sameCls = (x) => x.hcls === x.ref.cls; const signOf = (c) => (c === 'supports' ? 1 : c === 'opposes' ? -1 : 0)
out.P = { N: 433, n: RP.length, claseIgualReferencia: est(RP, sameCls), signoOpuesto: est(RP, (x) => signOf(x.hcls) * signOf(x.ref.cls) === -1), humanoNoEncuentraPosicion: est(RP, (x) => ['not_mentioned', 'ambiguous', 'contexto_insuficiente'].includes(x.hcls)) }
const same = RP.filter((x) => x.ref.int != null && signOf(x.hcls) !== 0 && signOf(x.hcls) === Math.sign(x.ref.int)); const dInt = same.map((x) => Math.abs(x.int) - Math.abs(x.ref.int))
out.P.intensidad = { paresMismoSigno: same.length, humanoMenos: dInt.filter((d) => d < 0).length, igual: dInt.filter((d) => d === 0).length, humanoMas: dInt.filter((d) => d > 0).length }
const conf = {}; for (const x of RP) { const k = `${x.ref.cls}→${x.hcls}`; conf[k] = (conf[k] ?? 0) + 1 }; out.P.matrizReferenciaHumano = conf
const units = RP.map((x) => [x.hcls === 'contexto_insuficiente' ? 'ambiguous' : x.hcls, x.ref.cls]); const stratBoot = (B = 500) => { const r = rng(15015); const byT = {}; RP.forEach((x, i) => (byT[x.tier] ??= []).push(i)); const est2 = []
  for (let b = 0; b < B; b++) { const idx = []; for (const ids of Object.values(byT)) for (let k = 0; k < ids.length; k++) idx.push(ids[Math.floor(r() * ids.length)]); const u = idx.map((i) => units[i]); const a = krippendorffAlpha(u, 'nominal'); if (Number.isFinite(a)) est2.push(a) } est2.sort((a, b) => a - b); return [nz(est2[Math.floor(0.025 * est2.length)]), nz(est2[Math.floor(0.975 * est2.length)])] }
out.P.acuerdoHumanoReferencia = { nota: 'puntuales sobre la muestra de R (sin ponderar) con IC por bootstrap estratificado; descriptivo', alfaNominalClase: nz(krippendorffAlpha(units, 'nominal')), ic95: stratBoot(), gwetAC1: nz(gwetAC(units, CATS_C, 'none')),
  kappaClase: new Set(units.flat()).size > 1 ? nz(weightedKappa(units.map((u) => u[0]), units.map((u) => u[1]), CATS_C, 'none')) : null }
const bothI = same.filter((x) => Number.isInteger(x.int) && Number.isInteger(x.ref.int)); const hi = bothI.map((x) => x.int), ri = bothI.map((x) => x.ref.int)
out.P.acuerdoIntensidad = { n: bothI.length, alfaOrdinal: nz(krippendorffAlpha(bothI.map((x) => [x.int, x.ref.int]), 'ordinal')), kappaPonderado: new Set([...hi, ...ri]).size > 1 ? nz(weightedKappa(hi, ri, CATS_I, 'quadratic')) : null, gwetAC2: nz(gwetAC(bothI.map((x) => [x.int, x.ref.int]), CATS_I, 'quadratic')) }
// 3) Celdas SIN posición registrada: proporción con posición recuperable según el humano
out.sinPosicion = { N: RN[0]?.N ?? 591, n: RN.length, humanoEncuentraPosicion: est(RN, (x) => ['supports', 'opposes', 'explicit_neutral'].includes(x.hcls)), distribucion: Object.fromEntries(classes.map((c) => [c, RN.filter((x) => x.hcls === c).length])) }
// Tamaño potencial de las posiciones no registradas en el marco de R (591 celdas sin posición): N × proporción, con IC del diseño. ANTES DE ADJUDICAR: son posiciones que el humano encuentra, no confirmadas.
const potN = out.sinPosicion.N; const potBy = (f) => { const e = est(RN, f); return { p: e.p, estimadas: Math.round(potN * e.p), ic95: [Math.round(potN * e.lo), Math.round(potN * e.hi)] } }
out.omisionesPotenciales = { marco: 'celdas sin posición de las preguntas de DESARROLLO (marco de R); no extrapola a E ni a todo el banco', N: potN, cualquierPosicion: potBy((x) => POS.includes(x.hcls)), apoya: potBy((x) => x.hcls === 'supports'), seOpone: potBy((x) => x.hcls === 'opposes'), aviso: 'Pendiente de adjudicación: el humano las encuentra en los pasajes dados; la adjudicación puede descartarlas o confirmarlas.' }
const T1 = T.filter((x) => x.tier === 'T1_candidata_omision'), T2 = T.filter((x) => x.tier === 'T2_resto_S')
out.T1 = { n: T1.length, humanoEncuentraPosicion: T1.filter((x) => ['supports', 'opposes', 'explicit_neutral'].includes(x.hcls)).length, distribucion: Object.fromEntries(classes.map((c) => [c, T1.filter((x) => x.hcls === c).length])), nota: 'dirigida por una regla léxica: NO es una tasa de omisión; mide la utilidad de la señal de candidatas' }
// 4) T2: humano vs IA (modalidad B) y vs referencia
const aiBy = {}; for (const r of aiRows) (aiBy[r.label] ??= {})[r.id] = r
const FULL = ['llama-4-scout', 'minimax-m3.1-flash', 'codex-gpt-6.2-sol']
const pair = (a, b, pairs) => { const sg = pairs.filter((p) => [p.x.cls, p.y.cls].every((c) => c === 'supports' || c === 'opposes')); const bi = pairs.filter((p) => p.x.cls === p.y.cls && p.x.int != null && p.y.int != null)
  return { a, b, n: pairs.length, evaluable: pairs.length >= 10, claseExacta: pairs.length ? nz(pairs.filter((p) => p.x.cls === p.y.cls).length / pairs.length) : null, kappaClase: pairs.length >= 10 && new Set(pairs.flatMap((p) => [p.x.cls, p.y.cls])).size > 1 ? nz(weightedKappa(pairs.map((p) => p.x.cls), pairs.map((p) => p.y.cls), CATS_C, 'none')) : null,
    signoDiscrepante: `${sg.filter((p) => p.x.cls !== p.y.cls).length}/${sg.length}`, nIntensidad: bi.length, intensidadExacta: bi.length ? nz(bi.filter((p) => p.x.int === p.y.int).length / bi.length) : null, kappaPondIntensidad: bi.length >= 5 && new Set([...bi.map((p) => p.x.int), ...bi.map((p) => p.y.int)]).size > 1 ? nz(weightedKappa(bi.map((p) => p.x.int), bi.map((p) => p.y.int), CATS_I, 'quadratic')) : null } }
out.T2 = { n: T2.length, humanoVsIA: FULL.map((L) => pair('humano', L, T2.filter((x) => aiBy[L]?.[x.id] && x.hcls !== 'contexto_insuficiente').map((x) => ({ x: { cls: x.hcls, int: x.int }, y: { cls: aiBy[L][x.id].cls, int: aiBy[L][x.id].int } })))),
  humanoVsReferencia: pair('humano', 'referencia', T2.filter((x) => x.ref.cls !== 'sin_posicion').map((x) => ({ x: { cls: x.hcls, int: x.int }, y: { cls: x.ref.cls, int: x.ref.int } }))) }
// 5) Fallos de recuperación (cita registrada no recuperada)
const nr = H.filter((x) => x.citaRecuperada === false); out.citaNoRecuperada = { n: nr.length, humanoClase: Object.fromEntries(classes.map((c) => [c, nr.filter((x) => x.hcls === c).length])), humanoNoEncuentra: nr.filter((x) => ['not_mentioned', 'ambiguous', 'contexto_insuficiente'].includes(x.hcls)).length }
// 6) Por dimensión y partido (descriptivo, R)
const byP = {}; for (const x of R) { const k = x.party; byP[k] ??= { n: 0, posiciones: 0 }; byP[k].n++; if (['supports', 'opposes', 'explicit_neutral'].includes(x.hcls)) byP[k].posiciones++ } out.porPartidoR = byP
out.manual = { v: '0.2', contextoInsuficiente: H.filter((x) => x.hcls === 'contexto_insuficiente').length }
fs.writeFileSync(path.join(OUT, 'h150', 'analisis_h150.json'), JSON.stringify(out, null, 1))
const e = (o) => (o ? `${pc(o.p)} (IC ${pc(o.lo)}–${pc(o.hi)})` : '—')
let md = `# Campaña humana v0.2 (150) — análisis preliminar (LOCAL)\n\n**Procedencia: ${PROV}${PROV === 'human_verified' ? '' : ' — NO VERIFICADA: no citar como evaluación humana (ver eval_provenance e integrity_check.mjs).'}** Evaluadas ${H.length} (R ${R.length}, T ${T.length}). Estimaciones de R con pesos de diseño (N_h, n_h, FPC); R y T nunca se mezclan. Referencia provisional: se mide concordancia, no exactitud.\n\n`
md += `## Marco de R (1.024 celdas): clase de la evaluación humana, estimada con pesos\n| Clase | Estimación (IC 95 %) |\n|---|---|\n` + classes.map((c) => `| ${c} | ${e(out.distribucionMarcoR[c])} |`).join('\n') + `\n\nPosición (apoya/se opone/neutral) encontrada: ${e(out.posicionEncontradaMarcoR)}. n efectivo de Kish (R): ${out.posicionEncontradaMarcoR.neff} de ${R.length}.\n\n`
md += `## Celdas CON posición registrada en el sistema (R, n=${RP.length} de N=433; incluye las ambiguas/no comparables)\n- Clase igual a la referencia: ${e(out.P.claseIgualReferencia)}\n- Signo opuesto: ${e(out.P.signoOpuesto)}\n- El humano no encuentra posición (no mencionado/ambigua/contexto insuficiente): ${e(out.P.humanoNoEncuentraPosicion)}\n- Intensidad (mismo signo, n=${out.P.intensidad.paresMismoSigno}): humano menos intenso ${out.P.intensidad.humanoMenos}, igual ${out.P.intensidad.igual}, más intenso ${out.P.intensidad.humanoMas}\n- Humano–referencia (descriptivo, muestra sin ponderar): α nominal ${out.P.acuerdoHumanoReferencia.alfaNominalClase} (IC bootstrap estratificado ${out.P.acuerdoHumanoReferencia.ic95.join('–')}), AC1 ${out.P.acuerdoHumanoReferencia.gwetAC1}, κ ${out.P.acuerdoHumanoReferencia.kappaClase}; intensidad: α ordinal ${out.P.acuerdoIntensidad.alfaOrdinal}, κ ponderado ${out.P.acuerdoIntensidad.kappaPonderado}, AC2 ${out.P.acuerdoIntensidad.gwetAC2} (n=${out.P.acuerdoIntensidad.n})\n- Matriz referencia→humano: ${JSON.stringify(out.P.matrizReferenciaHumano)}\n\n`
md += `## Posiciones potencialmente omitidas en el marco (${potN} celdas sin posición; PENDIENTE de adjudicar)\n- Cualquier posición: ≈ ${out.omisionesPotenciales.cualquierPosicion.estimadas} (IC ${out.omisionesPotenciales.cualquierPosicion.ic95.join('–')})\n- Apoya: ≈ ${out.omisionesPotenciales.apoya.estimadas} (${out.omisionesPotenciales.apoya.ic95.join('–')}); se opone: ≈ ${out.omisionesPotenciales.seOpone.estimadas} (${out.omisionesPotenciales.seOpone.ic95.join('–')}). Referencia: el release 2.1.2 tiene 147 negativas. ${out.omisionesPotenciales.aviso} ${out.omisionesPotenciales.marco}.\n\n## Celdas SIN posición registrada (R, n=${RN.length} de N=${out.sinPosicion.N})\n- El humano encuentra posición: ${e(out.sinPosicion.humanoEncuentraPosicion)}\n- Distribución: ${JSON.stringify(out.sinPosicion.distribucion)}\n\n## T1 (dirigida: candidatas de omisión, n=${T1.length})\n- Posición encontrada: ${out.T1.humanoEncuentraPosicion}/${T1.length}. ${out.T1.nota}\n- Distribución: ${JSON.stringify(out.T1.distribucion)}\n\n`
md += `## T2 (restos de S, n=${T2.length}): humano vs IA\n| A | B | n | Clase exacta | κ clase | Signo disc. | n int. | Int. exacta | κ pond. int. | Evaluable |\n|---|---|---|---|---|---|---|---|---|---|\n` + [...out.T2.humanoVsIA, out.T2.humanoVsReferencia].map((m) => `| ${m.a} | ${m.b} | ${m.n} | ${m.claseExacta} | ${m.kappaClase ?? '—'} | ${m.signoDiscrepante} | ${m.nIntensidad} | ${m.intensidadExacta ?? '—'} | ${m.kappaPondIntensidad ?? '—'} | ${m.evaluable ? 'sí (orientativo)' : 'NO (n<10)'} |`).join('\n')
md += `\n\n## Cita registrada no recuperada (n=${nr.length}): el humano no encuentra posición en ${out.citaNoRecuperada.humanoNoEncuentra}; distribución ${JSON.stringify(out.citaNoRecuperada.humanoClase)}\n\n## Limitaciones\n- Un único evaluador humano interno: sin concordancia humano–humano; procedencia ${PROV}.\n- Referencia provisional; marco = preguntas de desarrollo; humano–IA solo en T2.\n- Sin repetibilidad todavía (15 celdas preinscritas, ≥ 7 días).\n`
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/INFORME_campana150.md'), md); console.log(md)
