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
  const c = calls.filter((x) => x.evaluator_label === L); const ok = c.filter((x) => x.execution_status === 'ok'); const recv = c.filter((x) => ['ok', 'invalid_output'].includes(x.execution_status))
  const status = c.reduce((m, x) => ((m[x.execution_status] = (m[x.execution_status] ?? 0) + 1), m), {})
  const withQuote = ok.filter((x) => x.document_class && x.document_class !== 'not_mentioned' && x.document_class !== 'ambiguous')
  const byCell = {}; ok.forEach((x) => (byCell[x.cellId] ??= {})[x.repeat] = x)
  const pairs = Object.values(byCell).filter((v) => v[1] && v[2]); const stable = pairs.filter((v) => v[1].document_class === v[2].document_class).length
  const cmp = ok.filter((x) => x.repeat === 1 || !byCell[x.cellId][1]).map((x) => ({ x, ref: refClass(x.cellId) })).filter((o) => o.ref)
  const clsAgree = cmp.filter((o) => o.x.document_class === o.ref).length
  const signDis = cmp.filter((o) => ['supports', 'opposes'].includes(o.x.document_class) && ['supports', 'opposes'].includes(o.ref) && o.x.document_class !== o.ref).length
  const signComparable = cmp.filter((o) => ['supports', 'opposes'].includes(o.x.document_class) && ['supports', 'opposes'].includes(o.ref)).length
  const sameCls = cmp.filter((o) => o.x.document_class === o.ref && o.x.intensity !== null)
  per[L] = {
    llamadas: c.length, estados: status, provider: c[0]?.provider, vendor: c[0]?.model_family,
    T1_ok_rate: +(ok.length / (c.length || 1)).toFixed(3), T2_json_valido: recv.length ? +(ok.length / recv.length).toFixed(3) : null,
    T3_sin_fallback: ok.length ? +(ok.filter((x) => !x.fallback_used).length / ok.length).toFixed(3) : null,
    T4_latencia_mediana_s: med(ok.map((x) => x.latency_ms / 1000)), T4_latencia_p95_s: q95(ok.map((x) => x.latency_ms / 1000)),
    F1_cita_fiel: withQuote.length ? +(withQuote.filter((x) => ['exact', 'fuzzy'].includes(x.quote_verified)).length / withQuote.length).toFixed(3) : null, nConCita: withQuote.length,
    E1_estabilidad_clase: pairs.length ? +(stable / pairs.length).toFixed(3) : null, nParesEstabilidad: pairs.length,
    P1_parada: halted.find((h) => h.group === c[0]?.provider)?.reason ?? null,
    info_concordancia_referencia_provisional: { celdasComparables: cmp.length, claseCoincide: cmp.length ? +(clsAgree / cmp.length).toFixed(3) : null, discrepanciaSigno: signComparable ? +(signDis / signComparable).toFixed(3) : null, nSigno: signComparable, intensidadExacta: sameCls.length ? +(sameCls.filter((o) => o.x.intensity === refInt(o.x.cellId)).length / sameCls.length).toFixed(3) : null, intensidadMas1: sameCls.length ? +(sameCls.filter((o) => Math.abs(o.x.intensity - refInt(o.x.cellId)) <= 1).length / sameCls.length).toFixed(3) : null, nIntensidad: sameCls.length },
    usoNotMentioned: ok.length ? +(ok.filter((x) => x.document_class === 'not_mentioned').length / ok.length).toFixed(3) : null,
  }
  const T = per[L]
  T.criterios = { T1: T.T1_ok_rate >= 0.9, T2: (T.T2_json_valido ?? 0) >= 0.95, T3: (T.T3_sin_fallback ?? 0) >= 0.95, T4: (T.T4_latencia_mediana_s ?? 1e9) <= 30 && (T.T4_latencia_p95_s ?? 1e9) <= 60, F1: (T.F1_cita_fiel ?? 0) >= 0.9, E1: (T.E1_estabilidad_clase ?? 0) >= 0.85, P1: !T.P1_parada }
  T.pasaA_B = Object.values(T.criterios).every(Boolean)
  T.revisarPorSigno = (T.info_concordancia_referencia_provisional.discrepanciaSigno ?? 0) > 0.15
}
// Concordancia entre modelos (sin referencia): unidades = celdas; evaluadores = modelos (1.ª repetición correcta)
const cells = [...new Set(calls.map((c) => c.cellId))]
const firstOk = (L, cell) => calls.find((c) => c.cellId === cell && c.evaluator_label === L && c.execution_status === 'ok' && c.repeat === 1) ?? calls.find((c) => c.cellId === cell && c.evaluator_label === L && c.execution_status === 'ok')
const clsU = cells.map((cell) => labels.map((L) => firstOk(L, cell)?.document_class ?? null))
const intU = cells.map((cell) => labels.map((L) => { const x = firstOk(L, cell); return x && x.intensity !== null ? x.intensity : null }))
const catsC = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous']
const acuerdo = { modelos: labels.length, celdas: cells.length, clase: { krippendorffNominal: alphaCI(clsU, 'nominal', 500), gwetAC1: gwetAC(clsU, catsC, 'none') }, intensidad: { krippendorffOrdinal: alphaCI(intU, 'ordinal', 500), gwetAC2_cuadratica: gwetAC(intU, [-2, -1, 0, 1, 2], 'quadratic') }, nota: 'Intensidad solo entre modelos que dieron intensidad numérica; la clase y la intensidad se analizan por separado. Sin referencia provisional.' }
const meta = { archivo: path.basename(file), llamadas: calls.length, paradas: halted, referencia: 'PROVISIONAL (codificaciones registradas; no son referencia dorada)' }
write('benchmark_analisis.json', { meta, modelos: per, acuerdo })
const tb = labels.map((L) => { const t = per[L]; const cr = t.criterios; return `| ${L} | ${pct(t.T1_ok_rate)} | ${pct(t.T2_json_valido ?? 0)} | ${pct(t.T3_sin_fallback ?? 0)} | ${t.T4_latencia_mediana_s?.toFixed(1)}/${t.T4_latencia_p95_s?.toFixed(1)} | ${pct(t.F1_cita_fiel ?? 0)} | ${pct(t.E1_estabilidad_clase ?? 0)} | ${t.pasaA_B ? 'PASA' : 'NO PASA (' + Object.entries(cr).filter(([, v]) => !v).map(([k]) => k).join(',') + ')'} |` }).join('\n')
write('benchmark_analisis.md', `# Análisis del benchmark (${meta.archivo})\n\nReferencia provisional. Criterios fijados en \`docs/methodology/fase1/criterios-aceptacion-modalidad-A.md\`.\n\n| Modelo | T1 ok | T2 JSON | T3 sin fallback | T4 mediana/p95 s | F1 cita | E1 estab. | Resultado |\n|---|---|---|---|---|---|---|---|\n${tb}\n\n## Concordancia entre modelos\n${JSON.stringify(acuerdo, null, 1)}\n`)
console.log(tb.replace(/\|/g, ' '))
