// Análisis LOCAL de la segunda auditoría ciega de ítems: acuerdo entre modelos, recuperación de controles positivos, falsos positivos en controles negativos, estabilidad (repeticiones),
// concordancia con la primera auditoría, y neutralidad. No llama a modelos. Excluye respuestas con fallback, estados técnicos y salidas no válidas.
import fs from 'node:fs'
import path from 'node:path'
import { OUT, ROOT } from './lib.mjs'
import { krippendorffAlpha, alphaCI, gwetAC, weightedKappa } from '../../app/lib/methodology/agreement.ts'
const FILE = process.argv.includes('--v2') ? 'item_audit_blind_v2.jsonl' : 'item_audit_blind.jsonl'; const SUF = process.argv.includes('--v2') ? '_v2' : ''
const rows = fs.readFileSync(path.join(OUT, FILE), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted)
const ok = rows.filter((r) => r.execution_status === 'ok' && !r.fallback_used && !r.cost_nonzero)
const first = JSON.parse(fs.readFileSync(path.join(OUT, 'auditoria_items.json'), 'utf8')).items
const byKey = {}; for (const r of ok) byKey[`${r.evaluator_label}|${r.itemKey}`] ??= r      // primera respuesta válida por (modelo, ítem)
const models = [...new Set(ok.map((r) => r.evaluator_label))].sort(); const nz = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null)
const dbl = (o) => o.verdict === 'doble_contenido' || (o.n_propositions >= 2 && !!o.counterexample)          // doble contenido señalado
const prob = (o) => o.verdict !== 'ok' || o.severity >= 2                                                    // cualquier problema relevante
const get = (m, k) => byKey[`${m}|${k}`]?.out
const itemIds = first.map((x) => x.questionId); const ctrlPos = [...new Set(ok.filter((r) => r.itemKind === 'control_positivo').map((r) => r.itemId))].sort(); const ctrlNeg = [...new Set(ok.filter((r) => r.itemKind === 'control_negativo').map((r) => r.itemId))].sort()
const known = first.find((x) => /sindicat/i.test(x.text) && /empresarial|patronal/i.test(x.text))
const cov = Object.fromEntries(models.map((m) => [m, itemIds.filter((id) => get(m, id)).length]))
const per = Object.fromEntries(models.map((m) => [m, { items: cov[m], marcanDoble: itemIds.filter((id) => get(m, id) && dbl(get(m, id))).length, marcanProblema: itemIds.filter((id) => get(m, id) && prob(get(m, id))).length,
  controlPositivo: `${ctrlPos.filter((id) => get(m, id) && dbl(get(m, id))).length}/${ctrlPos.filter((id) => get(m, id)).length}`, controlNegativo_falsosPositivos: `${ctrlNeg.filter((id) => get(m, id) && dbl(get(m, id))).length}/${ctrlNeg.filter((id) => get(m, id)).length}`,
  sindicatos: known ? (get(m, known.questionId) ? (dbl(get(m, known.questionId)) ? 'señalada' : 'NO señalada') : '—') : '—' }]))
// Estabilidad: repeticiones
const rep = ok.filter((r) => r.itemKind === 'repeticion'); const stab = models.map((m) => { const rs = rep.filter((r) => r.evaluator_label === m); const pairs = rs.map((r) => [byKey[`${m}|${r.itemId}`]?.out, r.out]).filter(([a, b]) => a && b); return { modelo: m, pares: pairs.length, igualDoble: pairs.filter(([a, b]) => dbl(a) === dbl(b)).length } })
// Acuerdo entre modelos (señala doble contenido sí/no) en ítems con ≥2 modelos
const U = itemIds.map((id) => models.map((m) => (get(m, id) ? (dbl(get(m, id)) ? 1 : 0) : null))); const multi = U.filter((u) => u.filter((v) => v !== null).length >= 2)
const agree = multi.length >= 10 ? { itemsConAlMenos2Modelos: multi.length, alfa: nz(alphaCI(multi, 'nominal', 500).alpha), ic95: [nz(alphaCI(multi, 'nominal', 500).lo), nz(alphaCI(multi, 'nominal', 500).hi)], gwetAC1: nz(gwetAC(multi, [0, 1], 'none')) } : { itemsConAlMenos2Modelos: multi.length, nota: 'insuficiente (<10)' }
// Frente a la primera auditoría (clase A = doble contenido probable)
const firstA = new Set(first.filter((x) => (x.judgments ?? []).some((j) => j.cls === 'A')).map((x) => x.questionId))
const votes = Object.fromEntries(itemIds.map((id) => [id, models.filter((m) => get(m, id) && dbl(get(m, id))).length])); const nmod = Object.fromEntries(itemIds.map((id) => [id, models.filter((m) => get(m, id)).length]))
const cmp = { primeraAuditoriaA: firstA.size, nuevosModelosSeñalanAlMenos1: itemIds.filter((id) => votes[id] >= 1).length, alMenos2: itemIds.filter((id) => votes[id] >= 2).length, alMenos3: itemIds.filter((id) => votes[id] >= 3).length,
  coincidenPrimeraYAlMenos2: itemIds.filter((id) => firstA.has(id) && votes[id] >= 2).length, soloPrimera: itemIds.filter((id) => firstA.has(id) && votes[id] === 0 && nmod[id] >= 2).length, soloModelos2: itemIds.filter((id) => !firstA.has(id) && votes[id] >= 2).length }
// Neutralidad
const fav = {}; for (const m of models) for (const id of itemIds) { const o = get(m, id); if (o) { const k = o.agree_favors; fav[k] = (fav[k] ?? 0) + 1 } }
const loaded = itemIds.filter((id) => models.filter((m) => get(m, id)?.loaded_terms?.length).length >= 2)
const neut = { respuestasPorDireccion: fav, itemsConTerminosCargadosEnAlMenos2: loaded.length, itemsDireccionNoClaraEnAlMenos2: itemIds.filter((id) => models.filter((m) => get(m, id) && get(m, id).direction_clear === false).length >= 2).length }
const corrFile = path.join(ROOT, 'docs/methodology/local/correcciones_items.json'); const split = fs.existsSync(corrFile) ? new Set(JSON.parse(fs.readFileSync(corrFile, 'utf8')).divididas.map((x) => x.n)) : new Set()
const nOf = Object.fromEntries(first.map((x) => [x.questionId, x.n])); const cobN = (id) => models.filter((m) => get(m, id)).length
const corr = { dividas: split.size, conAlMenos2Modelos: [...split].filter((n) => { const id = first.find((f) => f.n === n).questionId; return votes[id] >= 2 }).length, mediaVotosDivididas: nz([...split].reduce((a, n) => a + votes[first.find((f) => f.n === n).questionId], 0) / (split.size || 1)), mediaVotosResto: nz(itemIds.filter((id) => !split.has(nOf[id])).reduce((a, id) => a + votes[id], 0) / (itemIds.length - split.size)), dosModelosOmasNoDivididas: itemIds.filter((id) => !split.has(nOf[id]) && votes[id] >= 2).map((id) => 'Q' + nOf[id]) }
const out = { correccionesAplicadas: corr, generado: new Date().toISOString(), modelos: models, respuestasValidas: ok.length, estadosTecnicos: rows.reduce((m, r) => ((m[r.execution_status + (r.fallback_used ? '+fallback' : '')] = (m[r.execution_status + (r.fallback_used ? '+fallback' : '')] ?? 0) + 1), m), {}), cobertura: cov, porModelo: per, estabilidad: stab, acuerdoEntreModelos: agree, frenteAPrimeraAuditoria: cmp, neutralidad: neut }
fs.writeFileSync(path.join(OUT, `item_audit_blind_analisis${SUF}.json`), JSON.stringify(out, null, 1))
const ids = itemIds.filter((id) => votes[id] >= 2).map((id) => { const x = first.find((f) => f.questionId === id); return `- Q${x.n}: ${x.text} (${votes[id]}/${nmod[id]} modelos; primera auditoría: ${firstA.has(id) ? 'sí' : 'no'})` })
fs.writeFileSync(path.join(ROOT, `docs/methodology/local/INFORME_auditoria_items_2${SUF}.md`), `# Segunda auditoría ciega de ítems (LOCAL)\n\nModelos: ${models.join(', ')}. Respuestas válidas: ${ok.length}.\n\n\`\`\`json\n${JSON.stringify(out, null, 1)}\n\`\`\`\n\n## Ítems señalados como doble contenido por ≥2 modelos independientes\n${ids.join('\n')}\n`)
console.log(JSON.stringify(out, null, 1))
