// Análisis LOCAL del piloto de evaluación humana (19 celdas): humano INTERNO vs evaluadores de IA de la modalidad B, y IA–IA en las mismas celdas.
// No llama a modelos, no escribe en la BD ni toca el banco/scoring/posiciones. Resultados en docs/methodology/local/out/ (local, no se publica).
// PROCEDENCIA: se lee de eval_provenance. Si no es 'human_verified' (en el piloto: un agente de IA operó la cuenta), NINGUNA cifra se presenta como humana: son IA–IA.
// LIMITACIONES (se imprimen en el informe): evaluador humano INTERNO (no referencia independiente; no hay concordancia humano–humano); muestra DIRIGIDA de 19 celdas
// (sesgo de selección: no se extrapola al banco); n muy pequeño: las métricas son orientativas y sirven para detectar problemas del manual y del procedimiento.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { OUT, ROOT, loadRelease } from './lib.mjs'
import { krippendorffAlpha, alphaCI, weightedKappa, gwetAC } from './agreement.mjs'

const CATS_C = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous'], CATS_I = [-2, -1, 0, 1, 2]
const nz = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null)
const sign = (c) => (c === 'supports' ? 1 : c === 'opposes' ? -1 : 0)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })

// Humano interno (solo evaluaciones finalizadas de la campaña piloto) con su motivo de selección
const { rows: camp } = await pool.query(`SELECT id, name FROM eval_campaigns WHERE kind = 'pilot' ORDER BY created_at LIMIT 1`)
const { rows: prov } = await pool.query(`SELECT DISTINCT ON (scope) scope, provenance, statement FROM eval_provenance WHERE campaign_id = $1 ORDER BY scope, recorded_at DESC`, [camp[0].id])
const PROV = (prov.find((x) => x.scope === 'evaluation') ?? prov.find((x) => x.scope === 'all'))?.provenance ?? 'unverified'
const HUMAN = PROV === 'human_verified'
const HL = HUMAN ? 'Humano interno' : 'Operador de la cuenta «Humano interno 1» (NO verificado como humano; procedencia: ' + PROV + ')'
const { rows: hum } = await pool.query(
  `SELECT pc.question_id, pc.entity_id, pc.document_class, pc.intensity, pc.insufficient_context, pc.rationale, pc.evidence, ce.ord, ce.blind_label
     FROM position_codings pc JOIN eval_cells ce ON ce.campaign_id = pc.campaign_id AND ce.question_id = pc.question_id AND ce.entity_id = pc.entity_id
    WHERE pc.campaign_id = $1 AND pc.evaluator_kind = 'human' ORDER BY ce.ord`, [camp[0].id])
await pool.end()
const H = Object.fromEntries(hum.map((r) => [`${r.question_id}|${r.entity_id}`, r]))
const pilot = JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8')).cells
const pack = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8')); const byId = Object.fromEntries(pack.S.map((c) => [c.cellId, c]))
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))

// Evaluadores de IA efectivos (mismos filtros que la hoja de adjudicación: ok, sin fallback, CLI con uso) y primera repetición
const recs = fs.readFileSync(path.join(OUT, 'benchmark_S_B.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens))
const A = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!A[k] || r.repeat < A[k].repeat) A[k] = r }
const labels = [...new Set(recs.map((r) => r.evaluator_label))].sort()

const ids = pilot.map((c) => c.cellId).filter((id) => H[id])
const cellRows = ids.map((id) => ({ id, h: H[id], motivos: pilot.find((c) => c.cellId === id).motivos, ai: Object.fromEntries(labels.map((L) => [L, A[id + '|' + L] ?? null])) }))

const metricsPair = (name, pairs) => {   // pairs: [{h:{class,intensity}, x:{class,intensity}}]
  const cls = pairs.map((p) => [p.h.class, p.x.class])
  const signPairs = pairs.filter((p) => [p.h.class, p.x.class].every((c) => c === 'supports' || c === 'opposes'))
  const both = pairs.filter((p) => p.h.class === p.x.class && p.h.intensity != null && p.x.intensity != null)
  const hi = both.map((p) => p.h.intensity), xi = both.map((p) => p.x.intensity)
  const ok = both.length >= 5 && new Set([...hi, ...xi]).size > 1
  return {
    evaluador: name, nClase: pairs.length,
    claseExacta: pairs.length ? nz(pairs.filter((p) => p.h.class === p.x.class).length / pairs.length) : null,
    kappaClase: pairs.length >= 10 && new Set(cls.flat()).size > 1 ? nz(weightedKappa(cls.map((u) => u[0]), cls.map((u) => u[1]), CATS_C, 'none')) : null,
    alfaNominalClase: pairs.length >= 10 ? nz(krippendorffAlpha(cls, 'nominal')) : null,
    gwetAC1Clase: pairs.length >= 10 ? nz(gwetAC(cls, CATS_C, 'none')) : null,
    discrepanciasSigno: `${signPairs.filter((p) => p.h.class !== p.x.class).length}/${signPairs.length}`,
    nIntensidad: both.length, intensidadExacta: both.length ? nz(both.filter((p) => p.h.intensity === p.x.intensity).length / both.length) : null,
    MAD: both.length ? nz(both.reduce((s, p) => s + Math.abs(p.h.intensity - p.x.intensity), 0) / both.length) : null,
    kappaPonderadoIntensidad: ok ? nz(weightedKappa(hi, xi, CATS_I, 'quadratic')) : null,
    alfaOrdinalIntensidad: ok ? nz(krippendorffAlpha(both.map((p) => [p.h.intensity, p.x.intensity]), 'ordinal')) : null,
    evaluable: pairs.length >= 10 ? 'sí (n≥10; orientativo)' : 'NO EVALUABLE (n<10)'
  }
}
const hClass = (r) => (r.insufficient_context && !r.document_class ? null : { class: r.document_class, intensity: r.intensity })
const vsAI = labels.map((L) => metricsPair(L, cellRows.filter((c) => c.ai[L] && hClass(c.h)).map((c) => ({ h: hClass(c.h), x: { class: c.ai[L].document_class, intensity: c.ai[L].intensity } }))))
// Consenso de IA (mayoría simple de clase entre los evaluadores efectivos completos, empates = sin consenso)
const FULL = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_B_informe.json'), 'utf8')).evaluadoresCompletos
const consensus = cellRows.map((c) => { const v = FULL.map((L) => c.ai[L]?.document_class).filter(Boolean); const cnt = {}; v.forEach((x) => (cnt[x] = (cnt[x] ?? 0) + 1)); const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]); return top.length && (top.length === 1 || top[0][1] > top[1][1]) ? top[0][0] : null })
// IA–IA en las mismas celdas (los tres evaluadores completos) y con el humano interno como columna adicional (solo orientativo)
const unitsAI = cellRows.map((c) => FULL.map((L) => c.ai[L]?.document_class ?? null))
const unitsAIint = cellRows.map((c) => FULL.map((L) => c.ai[L]?.intensity ?? null))
const unitsWithH = cellRows.map((c, i) => [...unitsAI[i], hClass(c.h)?.class ?? null])
const aiai = { evaluadores: FULL, celdas: cellRows.length, claseKrippendorffNominal: alphaCI(unitsAI, 'nominal', 500), claseGwetAC1: nz(gwetAC(unitsAI, CATS_C, 'none')), intensidadAlfaOrdinal: nz(krippendorffAlpha(unitsAIint, 'ordinal')) }
const conHumano = { nota: 'Humano INTERNO añadido como un evaluador más; NO es concordancia humano–humano independiente.', claseKrippendorffNominal: alphaCI(unitsWithH, 'nominal', 500), claseGwetAC1: nz(gwetAC(unitsWithH, CATS_C, 'none')) }
const vsConsensus = metricsPair('consenso IA (mayoría de los 3 completos)', cellRows.map((c, i) => ({ c, i })).filter(({ c, i }) => consensus[i] && hClass(c.h)).map(({ c, i }) => ({ h: hClass(c.h), x: { class: consensus[i], intensity: null } })))
// Frente a la referencia provisional (solo información; no es verdad terreno)
const refCls = (id) => { const p = pm.get(id); if (!p || p.value == null) return 'sin_posicion'; return p.value > 0 ? 'supports' : p.value < 0 ? 'opposes' : 'explicit_neutral' }
const vsRef = { n: cellRows.length, coincideSigno: cellRows.filter((c) => { const r = refCls(c.id); return hClass(c.h) && sign(hClass(c.h).class) === sign(r) && r !== 'sin_posicion' }).length, sinPosicionRegistrada: cellRows.filter((c) => refCls(c.id) === 'sin_posicion').length, conPosicion: cellRows.filter((c) => refCls(c.id) !== 'sin_posicion').length }

const dist = {}; hum.forEach((r) => { const k = r.insufficient_context && !r.document_class ? 'contexto_insuficiente' : r.document_class; dist[k] = (dist[k] ?? 0) + 1 })
const result = { generado: new Date().toISOString(), procedencia: PROV, campana: camp[0].name, celdasEvaluadasPorHumano: hum.length, distribucionHumana: dist, vsEvaluadoresIA: vsAI, vsConsensoIA: vsConsensus, iaIA: aiai, conHumanoComoColumna: conHumano, vsReferenciaProvisional: vsRef,
  limitaciones: [HUMAN ? 'Humano INTERNO: no es una referencia humana independiente; no se afirma concordancia humano–humano.' : `PROCEDENCIA: ${(prov[0]?.statement) ?? 'sin declaración'} Estas cifras son IA–IA, NO humano–IA.`, 'Muestra DIRIGIDA de 19 celdas (sesgo de selección): no se extrapola al banco.', 'n muy pequeño: métricas orientativas; con n<10 pares, NO EVALUABLE.', 'Ceguera parcial (conocimiento del proyecto; pasajes que pueden delatar al partido).'] }
fs.writeFileSync(path.join(OUT, 'pilot19_humano_vs_ia.json'), JSON.stringify(result, null, 2))

// Hoja de discrepancias para la adjudicación (LOCAL: contiene la referencia y las respuestas de IA)
const short = (x) => (x ? `${x.document_class}${x.intensity != null ? (x.intensity > 0 ? ' +' : ' ') + x.intensity : ''}` : '—')
let md = `# Piloto de 19 celdas — ${HUMAN ? "humano interno" : "agente operador de «Humano interno 1»"} vs IA (LOCAL)\n\nGenerado ${result.generado}. **Contiene referencia y respuestas de IA: usar solo para adjudicar, tras haber evaluado.** ${HUMAN ? 'Humano interno ≠ referencia independiente.' : '**PROCEDENCIA NO HUMANA: las evaluaciones comparadas las produjo un agente de IA operando la cuenta «Humano interno 1» (ver eval_provenance). Todas las cifras de este informe son IA–IA y NO pueden citarse como validación humana.**'}\n\n## Resumen\n- Distribución de las evaluaciones de la cuenta: ${JSON.stringify(dist)}\n- IA–IA (mismas 19 celdas, ${FULL.join(', ')}): α nominal clase ${nz(aiai.claseKrippendorffNominal.alpha)} (IC ${nz(aiai.claseKrippendorffNominal.lo)}–${nz(aiai.claseKrippendorffNominal.hi)}), AC1 ${aiai.claseGwetAC1}, α ordinal intensidad ${aiai.intensidadAlfaOrdinal}\n- ${HL} vs consenso de IA: clase exacta ${vsConsensus.claseExacta} (n=${vsConsensus.nClase}), discrepancias de signo ${vsConsensus.discrepanciasSigno}\n\n## ${HUMAN ? 'Humano interno' : 'Operador (agente) de «Humano interno 1»'} vs cada evaluador de IA\n| Evaluador | n | Clase exacta | κ clase | α nominal | AC1 | Signo disc. | n int. | Int. exacta | MAD | κ pond. int. | α ord. int. | Evaluable |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n` +
  vsAI.map((m) => `| ${m.evaluador} | ${m.nClase} | ${m.claseExacta} | ${m.kappaClase ?? '—'} | ${m.alfaNominalClase ?? '—'} | ${m.gwetAC1Clase ?? '—'} | ${m.discrepanciasSigno} | ${m.nIntensidad} | ${m.intensidadExacta ?? '—'} | ${m.MAD ?? '—'} | ${m.kappaPonderadoIntensidad ?? '—'} | ${m.alfaOrdinalIntensidad ?? '—'} | ${m.evaluable} |`).join('\n') +
  `\n\n## Celdas (orden de presentación)\n| # | Evaluación de la cuenta | Referencia provisional | ${labels.join(' | ')} | Motivos de selección | Discrepa |\n|---|---|---|${labels.map(() => '---').join('|')}|---|---|\n`
const rows = cellRows.map((c, i) => { const h = c.h; const mine = h.insufficient_context && !h.document_class ? 'contexto insuficiente' : short(h); const ref = pm.get(c.id) ? `${pm.get(c.id).value} (${pm.get(c.id).stanceStatus})` : 'sin posición'
  const diff = (h.document_class && FULL.some((L) => c.ai[L] && c.ai[L].document_class !== h.document_class)) || (h.insufficient_context && !h.document_class)
  return { diff, line: `| ${h.ord} | ${mine} | ${ref} | ${labels.map((L) => short(c.ai[L])).join(' | ')} | ${c.motivos.join('; ')} | ${diff ? 'SÍ' : ''} |` } })
md += rows.map((r) => r.line).join('\n') + `\n\n${rows.filter((r) => r.diff).length} celdas con alguna discrepancia respecto a los 3 evaluadores completos.\n\n## Limitaciones\n${result.limitaciones.map((l) => `- ${l}`).join('\n')}\n`
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/INFORME_piloto19.md'), md)
console.log(JSON.stringify({ dist, aiai: { alpha: nz(aiai.claseKrippendorffNominal.alpha), lo: nz(aiai.claseKrippendorffNominal.lo), hi: nz(aiai.claseKrippendorffNominal.hi) }, vsConsenso: { exacta: vsConsensus.claseExacta, n: vsConsensus.nClase, signo: vsConsensus.discrepanciasSigno }, vsRef }, null, 1))
