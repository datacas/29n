// Fase 1 · Análisis de resultados del benchmark (solo lectura de los JSONL). Aplica los criterios de
// docs/methodology/fase1/criterios-aceptacion-modalidad-A.md. La referencia (codificación registrada) es PROVISIONAL.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, write, pct } from './lib.mjs'
import { alphaCI, krippendorffAlpha, weightedKappa, gwetAC } from './agreement.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d }
const file = arg('file'); if (!file) { console.error('Uso: --file <jsonl> [--set S] [--modality A]'); process.exit(2) }
const recs = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const halted = recs.filter((r) => r.halted); const calls = recs.filter((r) => !r.halted)
const r = loadRelease('2.1.2'); const posOf = new Map(r.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const refClass = (cellId) => { const p = posOf.get(cellId); if (!p) return null; if (p.stanceStatus === 'explicit_neutral' || p.value === 0) return 'explicit_neutral'; if (p.value > 0) return 'supports'; if (p.value < 0) return 'opposes'; return null }
const refInt = (cellId) => posOf.get(cellId)?.value ?? null
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null), q95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(0.95 * a.length))] : null)
const labels = [...new Set(calls.map((c) => c.evaluator_label))]
const per = {}
for (const L of labels) {
  const c = calls.filter((x) => x.evaluator_label === L)
  const recv = c.filter((x) => ['ok', 'invalid_output'].includes(x.execution_status))
  const fb = recv.filter((x) => x.fallback_used)                       // respuesta de otro modelo: NO se atribuye al pedido
  const own = recv.filter((x) => !x.fallback_used)                      // respuestas del modelo pedido
  const ok = own.filter((x) => x.execution_status === 'ok')
  const tech = c.reduce((m, x) => (['ok', 'invalid_output'].includes(x.execution_status) ? m : ((m[x.execution_status] = (m[x.execution_status] ?? 0) + 1), m)), {})
  const withQuote = ok.filter((x) => x.document_class && !['not_mentioned', 'ambiguous'].includes(x.document_class))
  const byCell = {}; ok.forEach((x) => ((byCell[x.cellId] ??= {})[x.repeat] = x))
  const pairs = Object.values(byCell).filter((v) => v[1] && v[2]); const stable = pairs.filter((v) => v[1].document_class === v[2].document_class).length
  const first = Object.values(byCell).map((v) => v[1] ?? v[2])
  const cmp = first.map((x) => ({ x, ref: refClass(x.cellId) })).filter((o) => o.ref)
  const clsAgree = cmp.filter((o) => o.x.document_class === o.ref).length
  const signPairs = cmp.filter((o) => ['supports', 'opposes'].includes(o.x.document_class) && ['supports', 'opposes'].includes(o.ref))
  const signDis = signPairs.filter((o) => o.x.document_class !== o.ref).length
  const sameCls = cmp.filter((o) => o.x.document_class === o.ref && o.x.intensity !== null)
  const lat = ok.map((x) => x.latency_ms / 1000)
  const halt = halted.find((h) => h.group === c[0]?.provider)?.reason ?? null
  const T = (per[L] = {
    provider: c[0]?.provider, vendor: c[0]?.model_family,
    denominadores: { intentadas: c.length, erroresTecnicos: tech, respuestasRecibidas: recv.length, conFallback_excluidas: fb.length, modelosQueRespondieronPorFallback: [...new Set(fb.map((x) => x.model_actual))], respuestasDelModeloPedido: own.length, validasDelModeloPedido: ok.length, conCitaEvaluable: withQuote.length, paresDeRepeticion: pairs.length, comparablesConReferencia: cmp.length, comparablesSigno: signPairs.length, comparablesIntensidad: sameCls.length },
    calidad: { M1_json_valido: own.length ? +(ok.length / own.length).toFixed(3) : null, M2_cita_fiel: withQuote.length ? +(withQuote.filter((x) => ['exact', 'fuzzy'].includes(x.quote_verified)).length / withQuote.length).toFixed(3) : null, M3_estabilidad_clase: pairs.length ? +(stable / pairs.length).toFixed(3) : null },
    operativa: { O1_ejecuciones_correctas: c.length ? +(recv.length / c.length).toFixed(3) : null, O2_sin_fallback: recv.length ? +(own.length / recv.length).toFixed(3) : null, O3_latencia_mediana_s: med(lat), O3_latencia_p95_s: q95(lat), O4_parada: halt },
    info_concordancia_referencia_provisional: { claseCoincide: cmp.length ? +(clsAgree / cmp.length).toFixed(3) : null, discrepanciaSigno: signPairs.length ? +(signDis / signPairs.length).toFixed(3) : null, intensidadExacta: sameCls.length ? +(sameCls.filter((o) => o.x.intensity === refInt(o.x.cellId)).length / sameCls.length).toFixed(3) : null, intensidadMas1: sameCls.length ? +(sameCls.filter((o) => Math.abs(o.x.intensity - refInt(o.x.cellId)) <= 1).length / sameCls.length).toFixed(3) : null },
    usoNotMentioned: ok.length ? +(ok.filter((x) => x.document_class === 'not_mentioned').length / ok.length).toFixed(3) : null,
  })
  T.criteriosCalidad = { M1: (T.calidad.M1_json_valido ?? 0) >= 0.95, M2: (T.calidad.M2_cita_fiel ?? 0) >= 0.9, M3: (T.calidad.M3_estabilidad_clase ?? 0) >= 0.85 }
  T.pasaA_B_porCalidad = Object.values(T.criteriosCalidad).every(Boolean)
  T.limitacionesOperativas = [ (T.operativa.O1_ejecuciones_correctas ?? 0) < 0.9 && 'O1', (T.operativa.O2_sin_fallback ?? 0) < 0.95 && 'O2', ((T.operativa.O3_latencia_mediana_s ?? 1e9) > 30 || (T.operativa.O3_latencia_p95_s ?? 1e9) > 60) && 'O3', T.operativa.O4_parada && 'O4' ].filter(Boolean)
  T.clasificacion = !T.pasaA_B_porCalidad ? 'NO PASA a B (calidad)' : T.limitacionesOperativas.length ? `válido con limitaciones operativas (${T.limitacionesOperativas.join(',')})` : 'PASA a B'
  T.revisarPorSigno = (T.info_concordancia_referencia_provisional.discrepanciaSigno ?? 0) > 0.15
}
// Concordancia entre modelos (sin referencia): unidades = celdas; evaluadores = modelos (1.ª repetición correcta)
const cells = [...new Set(calls.map((c) => c.cellId))]
const firstOk = (L, cell) => calls.find((c) => c.cellId === cell && c.evaluator_label === L && c.execution_status === 'ok' && !c.fallback_used && c.repeat === 1) ?? calls.find((c) => c.cellId === cell && c.evaluator_label === L && c.execution_status === 'ok' && !c.fallback_used)
const clsU = cells.map((cell) => labels.map((L) => firstOk(L, cell)?.document_class ?? null))
const intU = cells.map((cell) => labels.map((L) => { const x = firstOk(L, cell); return x && x.intensity !== null ? x.intensity : null }))
const catsC = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous']
const acuerdo = { modelos: labels.length, celdas: cells.length, clase: { krippendorffNominal: alphaCI(clsU, 'nominal', 500), gwetAC1: gwetAC(clsU, catsC, 'none') }, intensidad: { krippendorffOrdinal: alphaCI(intU, 'ordinal', 500), gwetAC2_cuadratica: gwetAC(intU, [-2, -1, 0, 1, 2], 'quadratic') }, nota: 'Intensidad solo entre modelos que dieron intensidad numérica; la clase y la intensidad se analizan por separado. Sin referencia provisional.' }
const meta = { archivo: path.basename(file), llamadas: calls.length, paradas: halted, referencia: 'PROVISIONAL (codificaciones registradas; no son referencia dorada)' }
write('benchmark_analisis.json', { meta, modelos: per, acuerdo })
const tb = labels.map((L) => { const t = per[L], q = t.calidad, o = t.operativa; return `| ${L} | ${pct(q.M1_json_valido ?? 0)} | ${pct(q.M2_cita_fiel ?? 0)} | ${pct(q.M3_estabilidad_clase ?? 0)} | ${pct(o.O1_ejecuciones_correctas ?? 0)} | ${pct(o.O2_sin_fallback ?? 0)} | ${o.O3_latencia_mediana_s?.toFixed(1)}/${o.O3_latencia_p95_s?.toFixed(1)} | ${t.clasificacion} |` }).join('\n')
write('benchmark_analisis.md', `# Análisis del benchmark (${meta.archivo})\n\nReferencia provisional. Calidad (M) decide el paso a B; viabilidad operativa (O) informa. Criterios fijados en \`docs/methodology/fase1/criterios-aceptacion-modalidad-A.md\`.\n\n| Modelo | M1 JSON | M2 cita | M3 estab. | O1 ok | O2 sin fallback | O3 mediana/p95 s | Clasificación |\n|---|---|---|---|---|---|---|---|\n${tb}\n\n## Concordancia entre modelos\n${JSON.stringify(acuerdo, null, 1)}\n`)
console.log(tb.replace(/\|/g, ' '))
