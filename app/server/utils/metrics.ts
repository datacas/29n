/**
 * Panel de métricas (local). Reutiliza el núcleo de concordancia ya verificado contra librerías externas (app/lib/methodology/agreement.mjs).
 * Principios:
 *  - Los grupos se SEPARAN: IA–IA, humano–IA, humano–humano, repetibilidad intraevaluador. Nunca se mezclan en una misma cifra.
 *  - «Humano» solo si la procedencia vigente es `human_verified` (eval_provenance). Filas humanas con procedencia `ai_agent` o `unverified` se muestran APARTE y etiquetadas; no cuentan como humanas.
 *  - Humano interno ≠ referencia independiente: la concordancia humano–humano solo se calcula con ≥ 2 evaluadores humanos verificados y externos.
 *  - Con menos de 10 pares la métrica es «no evaluable» (n demasiado pequeño); todos los informes llevan la limitación de muestra y de selección.
 */
import { krippendorffAlpha, alphaCI, weightedKappa, gwetAC } from '../../lib/methodology/agreement'
import type { Queryable } from './evaluation'

const CATS_C = ['supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous'], CATS_I = [-2, -1, 0, 1, 2]
const nz = (x: number | undefined | null) => (typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(3) : null)
const MIN_PAIRS = 10
export interface Coding { cell: string; label: string; cls: string; intensity: number | null }

export function pairMetrics(a: string, b: string, pairs: { x: Coding; y: Coding }[]) {
  const n = pairs.length
  const cls = pairs.map((p) => [p.x.cls, p.y.cls])
  const sign = pairs.filter((p) => [p.x.cls, p.y.cls].every((c) => c === 'supports' || c === 'opposes'))
  const both = pairs.filter((p) => p.x.cls === p.y.cls && p.x.intensity != null && p.y.intensity != null)
  const xi = both.map((p) => p.x.intensity as number), yi = both.map((p) => p.y.intensity as number)
  const okI = both.length >= 5 && new Set([...xi, ...yi]).size > 1
  return {
    a, b, nClase: n, evaluable: n >= MIN_PAIRS,
    claseExacta: n ? nz(pairs.filter((p) => p.x.cls === p.y.cls).length / n) : null,
    kappaClase: n >= MIN_PAIRS && new Set(cls.flat()).size > 1 ? nz(weightedKappa(cls.map((u) => u[0]), cls.map((u) => u[1]), CATS_C, 'none')) : null,
    discrepanciasSigno: `${sign.filter((p) => p.x.cls !== p.y.cls).length}/${sign.length}`,
    nIntensidad: both.length, intensidadExacta: both.length ? nz(both.filter((p) => p.x.intensity === p.y.intensity).length / both.length) : null,
    MAD: both.length ? nz(both.reduce((s, p) => s + Math.abs((p.x.intensity as number) - (p.y.intensity as number)), 0) / both.length) : null,
    kappaPonderadoIntensidad: okI ? nz(weightedKappa(xi, yi, CATS_I, 'quadratic')) : null,
    alfaOrdinalIntensidad: okI ? nz(krippendorffAlpha(both.map((p) => [p.x.intensity, p.y.intensity]), 'ordinal')) : null
  }
}

/** Acuerdo entre varios evaluadores (IA–IA o similares) sobre las celdas en las que hay ≥ 2 respuestas. */
export function groupMetrics(evals: string[], byEval: Map<string, Map<string, Coding>>, B: number) {
  const cells = [...new Set(evals.flatMap((e) => [...(byEval.get(e)?.keys() ?? [])]))]
  const clsU = cells.map((c) => evals.map((e) => byEval.get(e)?.get(c)?.cls ?? null))
  const intU = cells.map((c) => evals.map((e) => byEval.get(e)?.get(c)?.intensity ?? null))
  const multi = clsU.filter((u) => u.filter((v) => v !== null).length >= 2).length
  if (evals.length < 2 || multi < MIN_PAIRS) return { evaluadores: evals, celdas: cells.length, evaluable: false, motivo: `n insuficiente (${multi} celdas con ≥ 2 respuestas; mínimo ${MIN_PAIRS})` }
  const ci = alphaCI(clsU, 'nominal', B)
  const ciI = alphaCI(intU, 'ordinal', B)
  const pairs = []
  for (let i = 0; i < evals.length; i++) for (let j = i + 1; j < evals.length; j++) {
    const A = byEval.get(evals[i])!, Bm = byEval.get(evals[j])!
    pairs.push(pairMetrics(evals[i], evals[j], [...A.keys()].filter((c) => Bm.has(c)).map((c) => ({ x: A.get(c)!, y: Bm.get(c)! }))))
  }
  return {
    evaluadores: evals, celdas: cells.length, evaluable: true,
    clase: { alfaNominal: nz(ci.alpha), ic95: [nz(ci.lo), nz(ci.hi)], gwetAC1: nz(gwetAC(clsU, CATS_C, 'none')) },
    intensidad: { alfaOrdinal: nz(ciI.alpha), ic95: [nz(ciI.lo), nz(ciI.hi)], gwetAC2: nz(gwetAC(intU, CATS_I, 'quadratic')) },
    pares: pairs
  }
}

const LIMITACIONES = [
  'Muestras pequeñas y, en el piloto, dirigidas: sesgo de selección; no se extrapolan al banco.',
  'Con menos de 10 pares la métrica es «no evaluable».',
  'Humano interno ≠ referencia humana independiente. Sin ≥ 2 evaluadores humanos verificados externos no hay concordancia humano–humano.',
  'Las filas humanas con procedencia distinta de `human_verified` (p. ej. un agente de IA operando una cuenta) se muestran aparte y NO cuentan como humanas.'
]

export async function computeMetrics(db: Queryable, opts: { modality?: string; set?: string; bootstrap?: number } = {}) {
  const modality = opts.modality ?? 'B', set = opts.set ?? 'S', B = opts.bootstrap ?? 300
  // 1) IA: codificaciones efectivas de la modalidad/conjunto, primera repetición por (celda, evaluador)
  const { rows: ai } = await db.query(
    `SELECT DISTINCT ON (question_id, entity_id, evaluator_label) question_id||'|'||entity_id AS cell, evaluator_label AS label, document_class AS cls, intensity
       FROM position_codings WHERE evaluator_kind = 'ai' AND execution_status = 'ok' AND NOT fallback_used AND config->>'modality' = $1 AND config->>'set' = $2
      ORDER BY question_id, entity_id, evaluator_label, (config->>'repeat')::int NULLS LAST`, [modality, set])
  const aiBy = new Map<string, Map<string, Coding>>(); for (const r of ai) { if (!aiBy.has(r.label)) aiBy.set(r.label, new Map()); aiBy.get(r.label)!.set(r.cell, { cell: r.cell, label: r.label, cls: r.cls, intensity: r.intensity }) }
  const totalCells = new Set(ai.map((r: any) => r.cell)).size
  const evalCounts = [...aiBy.entries()].map(([label, m]) => ({ label, celdas: m.size })).sort((a, b) => b.celdas - a.celdas)
  const full = evalCounts.filter((e) => e.celdas >= 0.9 * (evalCounts[0]?.celdas ?? 0)).map((e) => e.label)
  const iaIa = { alcance: { modalidad: modality, conjunto: set, celdas: totalCells }, evaluadoresPorCobertura: evalCounts, evaluadoresCompletos: full, ...groupMetrics(full, aiBy, B) }

  // 2) Humanos por procedencia (vigente para el ámbito `evaluation` o `all`)
  const { rows: hum } = await db.query(
    `SELECT pc.question_id||'|'||pc.entity_id AS cell, pc.evaluator_label AS label, pc.evaluator_id, pc.campaign_id, k.kind AS "campaignKind", k.source_campaign_id AS "sourceCampaignId", pc.config->>'affiliation' AS affiliation,
            pc.document_class AS cls, pc.intensity, pc.insufficient_context AS "insufficientContext",
            coalesce((SELECT p.provenance FROM eval_provenance p WHERE p.evaluator_id = pc.evaluator_id AND p.campaign_id = pc.campaign_id AND p.scope IN ('evaluation', 'all') ORDER BY (p.scope = 'evaluation') DESC, p.recorded_at DESC LIMIT 1), 'unverified') AS provenance
       FROM position_codings pc JOIN eval_campaigns k ON k.id = pc.campaign_id WHERE pc.evaluator_kind = 'human' AND pc.execution_status = 'ok'`)
  // Alcance: solo las celdas de la modalidad/conjunto analizado (las mismas en las que están las IA).
  const scopeCells = new Set(ai.map((r: any) => r.cell))
  const groups: Record<string, any[]> = {}; for (const h of hum.filter((x: any) => scopeCells.has(x.cell))) (groups[h.provenance] ??= []).push(h)
  const humanVsAi = (rows: any[]) => {
    const byL = new Map<string, Map<string, Coding>>(); for (const r of rows.filter((x) => x.cls)) { if (!byL.has(r.label)) byL.set(r.label, new Map()); byL.get(r.label)!.set(r.cell, { cell: r.cell, label: r.label, cls: r.cls, intensity: r.intensity }) }
    return [...byL.entries()].map(([hl, hm]) => ({
      evaluador: hl, celdas: hm.size, sinClase: rows.filter((x) => x.label === hl && !x.cls).length,
      frente: [...aiBy.entries()].map(([al, am]) => pairMetrics(hl, al, [...hm.keys()].filter((c) => am.has(c)).map((c) => ({ x: hm.get(c)!, y: am.get(c)! }))))
    }))
  }
  const verified = groups.human_verified ?? []
  const nonHuman = Object.entries(groups).filter(([p]) => p !== 'human_verified').map(([provenance, rows]) => ({
    procedencia: provenance, aviso: provenance === 'ai_agent' ? 'Filas registradas como humanas producidas por un agente de IA: son IA–IA, NO humano–IA.' : 'Procedencia sin verificar: no se cita como humana.',
    filas: rows.length, comoIAvsIA: humanVsAi(rows)
  }))
  const humanoIa = verified.length ? { disponible: true, evaluadores: humanVsAi(verified), nota: 'Humano interno ≠ referencia independiente.' } : { disponible: false, motivo: 'No hay codificaciones humanas con procedencia verificada (`human_verified`).' }

  // 3) Humano–humano: ≥ 2 evaluadores humanos verificados y externos
  const ext = [...new Set(verified.filter((x) => x.affiliation === 'external').map((x) => x.label))]
  const humanoHumano = ext.length >= 2
    ? (() => { const by = new Map<string, Map<string, Coding>>(); for (const r of verified.filter((x) => x.affiliation === 'external' && x.cls)) { if (!by.has(r.label)) by.set(r.label, new Map()); by.get(r.label)!.set(r.cell, { cell: r.cell, label: r.label, cls: r.cls, intensity: r.intensity }) } return { disponible: true, ...groupMetrics(ext, by, B) } })()
    : { disponible: false, motivo: 'Requiere ≥ 2 evaluadores humanos externos con procedencia verificada. Hoy no existen: no se afirma concordancia humano–humano.' }

  // 4) Repetibilidad intraevaluador: mismo evaluador verificado, campaña de repetibilidad frente a su campaña de origen
  const rep: any[] = []
  for (const r of verified.filter((x) => x.campaignKind === 'repeatability' && x.cls && x.sourceCampaignId)) {
    const first = verified.find((x) => x.campaign_id === r.sourceCampaignId && x.evaluator_id === r.evaluator_id && x.cell === r.cell && x.cls)
    if (first) rep.push({ evaluator: r.label, x: { cell: r.cell, label: 'test', cls: first.cls, intensity: first.intensity }, y: { cell: r.cell, label: 'retest', cls: r.cls, intensity: r.intensity } })
  }
  const repetibilidad = rep.length ? { disponible: true, ...pairMetrics('test', 'retest', rep.map(({ x, y }) => ({ x, y }))), nota: 'Repetibilidad del mismo evaluador; no equivale a fiabilidad entre humanos independientes.' } : { disponible: false, motivo: 'Sin campañas de repetibilidad finalizadas por evaluadores con procedencia verificada.' }

  return { generado: new Date().toISOString(), iaIa, humanoIa, humanoHumano, repetibilidad, filasHumanasNoVerificadas: nonHuman, limitaciones: LIMITACIONES }
}
