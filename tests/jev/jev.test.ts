import { describe, expect, it, vi } from 'vitest'
import { JevApiError, JevClient, JevMissingKeyError, costUsd } from '../../app/lib/jev/client.ts'
import { agreement, computeMetrics } from '../../app/lib/jev/metrics.ts'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import {
  buildQuestions,
  buildState,
  claudePositionClass,
  jevPredictedClass,
  parseVerdict,
  reviewPosition
} from '../../app/lib/jev/review.ts'
import { stratifiedSample, stratumOf } from '../../app/lib/jev/sample.ts'
import { triage } from '../../app/lib/jev/triage.ts'
import { selectQuestions, TARGET_QUESTIONS } from '../../app/lib/survey/select-questions.ts'
import { buildAnswerArray } from '../../app/lib/survey/answers.ts'
import { buildReleasePayload, loadReleaseContent } from '../../app/lib/release/content.ts'
import { toPositionFields, ValueCodingError } from '../../app/lib/positions/value-coding.ts'
import { parseValueSuggestion, CHOICE_TO_VALUE } from '../../app/lib/jev/value-suggestion.ts'
import { assessClaim, buildClaimState, parseClaimRelevance } from '../../app/lib/jev/claim-relevance.ts'
import type { JevVerdict, PositionInput, SystemOneAnswer } from '../../app/lib/jev/types.ts'

const pos = (over: Partial<PositionInput> = {}): PositionInput => ({
  positionId: 'p1',
  party: 'PSOE',
  questionId: 'Q001',
  questionText: '¿El Estado debe aumentar las becas?',
  proposedStanceStatus: 'approved',
  claims: [
    { literalText: 'Reforzaremos las becas.', sourcePage: 3, conditions: 'Ninguna', claudeStance: 'agrees' }
  ],
  ...over
})

const answers = (over: Record<string, SystemOneAnswer> = {}): Record<string, SystemOneAnswer> => ({
  relevance: { type: 'choice', choice: 'direct', confidence: 0.9, probabilities: { direct: 0.9, tangential: 0.1, unrelated: 0 } },
  stance: { type: 'choice', choice: 'supports', confidence: 0.8, probabilities: { supports: 0.8, opposes: 0, conditional: 0.1, unclear: 0.1 } },
  evidence_sufficient: { type: 'noul', noul: 0.9 },
  contradiction: { type: 'noul', noul: 0.02 },
  condition_material: { type: 'noul', noul: 0.1 },
  ...over
})

const okResponse = (a = answers()) =>
  new Response(JSON.stringify({ model: 'jev-1.14.0', answers: a, usage: { input_tokens: 500, output_tokens: 20 } }), { status: 200 })

describe('JevClient (TypeSafe directo, con mocks)', () => {
  it('falla de forma explícita sin TYPESAFE_API_KEY', () => {
    const saved = { t: process.env.TYPESAFE_API_KEY, j: process.env.JEV_API_KEY }
    delete process.env.TYPESAFE_API_KEY
    delete process.env.JEV_API_KEY
    expect(() => new JevClient()).toThrow(JevMissingKeyError)
    process.env.JEV_API_KEY = 'k'
    expect(() => new JevClient()).not.toThrow()
    if (saved.t) process.env.TYPESAFE_API_KEY = saved.t; else delete process.env.TYPESAFE_API_KEY
    if (saved.j) process.env.JEV_API_KEY = saved.j; else delete process.env.JEV_API_KEY
  })

  it('envía POST a /v1/systemone con Bearer y el cuerpo System One', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse())
    const c = new JevClient({ apiKey: 'k', fetchImpl: fetchImpl as any })
    const r = await c.systemOne({ a: 1 }, { q: { type: 'noul', instructions: '¿x?' } })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer k')
    expect(JSON.parse(init.body)).toMatchObject({ model: 'jev-1.14.0', state: { a: 1 }, questions: { q: { type: 'noul' } } })
    expect(r.usage.input_tokens).toBe(500)
  })

  it('reintenta 429/5xx y devuelve la respuesta buena', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(okResponse())
    const c = new JevClient({ apiKey: 'k', fetchImpl: fetchImpl as any, maxRetries: 2 })
    await expect(c.systemOne('s', {})).resolves.toBeTruthy()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('no reintenta un 401 y lanza JevApiError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('no', { status: 401 }))
    const c = new JevClient({ apiKey: 'bad', fetchImpl: fetchImpl as any })
    await expect(c.systemOne('s', {})).rejects.toBeInstanceOf(JevApiError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('coste: solo tokens de entrada a $0.042/Mtok', () => {
    expect(costUsd(1_000_000)).toBeCloseTo(0.042)
  })
})

describe('estado y preguntas', () => {
  it('no pregunta needs_human_review', () => {
    expect(buildQuestions('independent')).not.toHaveProperty('needs_human_review')
  })

  it('modo independent NO envía la posición propuesta ni su pregunta', () => {
    const s = buildState(pos(), 'independent')
    expect(s).not.toHaveProperty('posicion_propuesta')
    expect(buildQuestions('independent')).not.toHaveProperty('proposal_matches')
  })

  it('modo with_proposal incluye posición propuesta y su pregunta', () => {
    expect(buildState(pos(), 'with_proposal')).toHaveProperty('posicion_propuesta')
    expect(buildQuestions('with_proposal')).toHaveProperty('proposal_matches')
  })

  it('las condiciones vacías ("Ninguna condición mencionada.") se envían como "ninguna"', () => {
    const p = pos({ claims: [{ literalText: 'x', conditions: 'Ninguna condición mencionada.' }] })
    expect((buildState(p, 'independent').citas as any[])[0].condiciones).toBe('ninguna')
  })
})

describe('parseVerdict / clases', () => {
  it('interpreta respuestas tipadas conservando probabilidades', () => {
    const v = parseVerdict(answers())
    expect(v.stance).toBe('supports')
    expect(v.stanceProbs.supports).toBe(0.8)
    expect(v.contradictionP).toBe(0.02)
  })

  it('una pregunta rechazada cuenta como abstención y queda registrada', () => {
    const v = parseVerdict(answers({ stance: { type: 'refusal' } }))
    expect(v.stance).toBe('abstain')
    expect(v.refusals).toContain('stance')
    expect(jevPredictedClass(v)).toBeNull()
  })

  it('contradicción alta gana a la postura; confianza baja => abstención', () => {
    expect(jevPredictedClass(parseVerdict(answers({ contradiction: { type: 'noul', noul: 0.9 } })))).toBe('contradictory')
    const low = parseVerdict(
      answers({ stance: { type: 'choice', choice: 'supports', confidence: 0.2, probabilities: { supports: 0.4, opposes: 0.3, conditional: 0.2, unclear: 0.1 } } })
    )
    expect(jevPredictedClass(low)).toBeNull()
  })

  it('agrega la postura de Claude por posición', () => {
    expect(claudePositionClass(pos())).toBe('supports')
    expect(
      claudePositionClass(pos({ claims: [{ literalText: 'a', claudeStance: 'agrees' }, { literalText: 'b', claudeStance: 'disagrees' }] }))
    ).toBe('contradictory')
    expect(claudePositionClass(pos({ claims: [{ literalText: 'a', claudeStance: 'unclear' }] }))).toBe('unclear')
  })

  it('reviewPosition hace una sola petición con todas las preguntas', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse())
    const c = new JevClient({ apiKey: 'k', fetchImpl: fetchImpl as any })
    const run = await reviewPosition(c, pos(), 'with_proposal')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(Object.keys(JSON.parse(fetchImpl.mock.calls[0][1].body).questions)).toContain('proposal_matches')
    expect(run.verdict.stance).toBe('supports')
  })
})

describe('verifyQuote (determinista)', () => {
  const pages = [
    { page: 3, text: 'Reforzaremos las becas y\nayudas al es-\ntudio en todo el país.' },
    { page: 9, text: 'Otro texto distinto sobre vivienda.' }
  ]
  it('encuentra citas exactas aunque haya saltos de línea y guiones', () => {
    expect(verifyQuote('«Reforzaremos las becas y ayudas al estudio»', pages, 3)).toBe('exact')
  })
  it('tolera ±1 página de desfase', () => {
    expect(verifyQuote('Reforzaremos las becas y ayudas', pages, 4)).toBe('exact')
  })
  it('detecta citas inventadas', () => {
    expect(verifyQuote('Abolir por completo el sistema educativo estatal', pages, 3)).toBe('not_found')
  })
  it('sin PDF => no_source', () => {
    expect(verifyQuote('lo que sea con longitud suficiente', undefined, 1)).toBe('no_source')
  })
  it('verifica cada fragmento separado por "..."', () => {
    expect(verifyQuote('Reforzaremos las becas ... ayudas al estudio en todo el país', pages, 3)).toBe('exact')
  })
})

describe('triaje', () => {
  const verdict = (o: Partial<JevVerdict> = {}): JevVerdict => ({ ...parseVerdict(answers()), ...o })

  it('revisión rápida: pertinente directa, suficiente y citas verificadas', () => {
    expect(triage({ verdict: verdict(), quoteStatuses: ['exact'] }).group).toBe('high_confidence')
  })
  it('la postura de Claude ya no influye (su señal era ≈ azar)', () => {
    expect(triage({ verdict: verdict(), claudeClass: 'opposes', quoteStatuses: ['exact'] }).group).toBe('high_confidence')
    expect(triage({ verdict: verdict(), claudeClass: 'conditional', quoteStatuses: ['exact'] }).group).toBe('high_confidence')
  })
  it('cita no encontrada o contradicción de Jev => conflicto', () => {
    expect(triage({ verdict: verdict(), quoteStatuses: ['not_found'] }).group).toBe('contradictory')
    expect(triage({ verdict: verdict({ contradictionP: 0.9 }), quoteStatuses: ['exact'] }).group).toBe('contradictory')
  })
  it('relevancia no directa o evidencia insuficiente => revisar con cuidado', () => {
    expect(triage({ verdict: verdict({ relevance: 'tangential' }), quoteStatuses: ['exact'] }).group).toBe('doubtful')
    expect(triage({ verdict: verdict({ evidenceSufficientP: 0.1 }), quoteStatuses: ['exact'] }).group).toBe('doubtful')
    expect(triage({ verdict: verdict({ evidenceSufficientP: null }), quoteStatuses: ['exact'] }).group).toBe('doubtful')
  })
  it('cita sin PDF o solo aproximada => nunca revisión rápida', () => {
    expect(triage({ verdict: verdict(), quoteStatuses: ['no_source'] }).group).toBe('doubtful')
    expect(triage({ verdict: verdict(), quoteStatuses: ['fuzzy'] }).group).toBe('doubtful')
  })
  it('needs_human_review y la abstención de stance no influyen', () => {
    expect(triage({ verdict: verdict({ needsReviewP: 0.99, stance: 'abstain', stanceConfidence: 0 }), quoteStatuses: ['exact'] }).group).toBe('high_confidence')
  })
})

describe('métricas', () => {
  it('calcula precisión/recall, falsos apoyos, inversiones y abstención', () => {
    const m = computeMetrics([
      { gold: 'supports', predicted: 'supports', latencyMs: 80, costUsd: 0.001 },
      { gold: 'opposes', predicted: 'supports', latencyMs: 100, costUsd: 0.001 },
      { gold: 'unclear', predicted: null, latencyMs: 90, costUsd: 0.001 },
      { gold: 'conditional', predicted: 'supports', latencyMs: 70, costUsd: 0.001 }
    ])
    expect(m.n).toBe(4)
    expect(m.abstentionRate).toBe(0.25)
    expect(m.falseSupport).toBe(2)
    expect(m.polarityFlips).toBe(1)
    expect(m.perClass.supports.precision).toBeCloseTo(1 / 3)
    expect(m.perClass.supports.recall).toBe(1)
    expect(m.uncertainDetectionRate).toBe(1)
    expect(m.latencyMs.p50).toBe(80)
    expect(m.costUsd).toBeCloseTo(0.004)
  })
  it('acuerdo ignora abstenciones', () => {
    expect(agreement([['supports', 'supports'], [null, 'opposes'], ['opposes', 'supports']])).toEqual({ comparable: 2, agree: 1, rate: 0.5 })
  })
})

describe('muestra estratificada', () => {
  const mk = (i: number, party: string, stance: string, text = 'Texto en castellano sobre políticas.'): PositionInput => ({
    positionId: `p${i}`, party, questionId: `Q${i}`, questionText: 'q',
    claims: [{ literalText: text, claudeStance: stance, conditions: 'Ninguna' }]
  })
  const all: PositionInput[] = [
    ...Array.from({ length: 10 }, (_, i) => mk(i, ['PSOE', 'PP'][i % 2], 'unclear')),
    ...Array.from({ length: 10 }, (_, i) => mk(100 + i, ['PSOE', 'PP'][i % 2], 'conditional_agrees')),
    ...Array.from({ length: 6 }, (_, i) => mk(200 + i, 'ERC', 'agrees', 'Els serveis públics amb aquesta llengua són també prioritaris.'))
  ]
  it('detecta catalán y reparte estratos', () => {
    expect(stratumOf(all[all.length - 1])).toBe('catalan')
    expect(stratumOf(all[0])).toBe('ambiguous')
    expect(stratumOf(all[10])).toBe('conditioned')
  })
  it('es reproducible con la misma semilla y respeta el tamaño', () => {
    const a = stratifiedSample(all, { size: 12, seed: 7 }).map((s) => s.position.positionId)
    const b = stratifiedSample(all, { size: 12, seed: 7 }).map((s) => s.position.positionId)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(12)
  })
})

describe('relevancia por cita', () => {
  it('envía una sola cita y la proposición, sin propuesta de Claude', () => {
    const st = buildClaimState({ questionText: 'q', party: 'PP', literalText: 'cita', sourcePage: 4 })
    expect(st).toEqual({ proposicion: 'q', partido: 'PP', cita_literal: 'cita', pagina: 4 })
  })
  it('interpreta noul y trata el rechazo como null', () => {
    expect(parseClaimRelevance({ relevant: { type: 'noul', noul: 0.8 } }).pRelevant).toBe(0.8)
    expect(parseClaimRelevance({ relevant: { type: 'refusal' } }).pRelevant).toBeNull()
  })
  it('assessClaim hace una petición con la pregunta "relevant"', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ model: 'jev-1.14.0', answers: { relevant: { type: 'noul', noul: 0.9 } }, usage: { input_tokens: 300, output_tokens: 5 } }), { status: 200 })
    )
    const c = new JevClient({ apiKey: 'k', fetchImpl: fetchImpl as any })
    const r = await assessClaim(c, { questionText: 'q', party: 'PP', literalText: 'x' })
    expect(r.pRelevant).toBe(0.9)
    expect(Object.keys(JSON.parse(fetchImpl.mock.calls[0][1].body).questions)).toEqual(['relevant'])
  })
})

describe('codificación de la postura', () => {
  it('±1/±2 sin condiciones => approved; con condiciones => conditional y exige el texto', () => {
    expect(toPositionFields({ kind: 'value', value: 2 })).toEqual({ value: 2, stance_status: 'approved', conditions: null })
    expect(toPositionFields({ kind: 'value', value: -1, conditional: true, conditions: ' si baja el IVA ' })).toEqual({ value: -1, stance_status: 'conditional', conditions: 'si baja el IVA' })
    expect(() => toPositionFields({ kind: 'value', value: 1, conditional: true, conditions: '  ' })).toThrow(ValueCodingError)
  })
  it('0 solo como neutralidad explícita, nunca condicional', () => {
    expect(toPositionFields({ kind: 'value', value: 0, conditional: true, conditions: 'x' })).toEqual({ value: 0, stance_status: 'explicit_neutral', conditions: null })
  })
  it('exclusiones no llevan valor (nunca se infiere 0)', () => {
    expect(toPositionFields({ kind: 'exclude', status: 'ambiguous' })).toEqual({ value: null, stance_status: 'ambiguous', conditions: null })
    expect(() => toPositionFields({ kind: 'exclude', status: 'not_stated' as any })).toThrow(ValueCodingError)
    expect(() => toPositionFields({ kind: 'value', value: 3 as any })).toThrow(ValueCodingError)
  })
})

describe('sugerencia de postura de Jev', () => {
  it('mapea opciones a la escala y la contradicción a null', () => {
    expect(CHOICE_TO_VALUE.strongly_for).toBe(2)
    expect(parseValueSuggestion({ position: { type: 'choice', choice: 'partially_against', confidence: 0.7, probabilities: { partially_against: 0.7 } } }).value).toBe(-1)
    expect(parseValueSuggestion({ position: { type: 'choice', choice: 'contradictory', confidence: 0.6, probabilities: {} } }).value).toBeNull()
  })
  it('un rechazo no inventa valor', () => {
    expect(parseValueSuggestion({ position: { type: 'refusal' } })).toEqual({ choice: null, value: null, confidence: null, probabilities: {} })
  })
})

describe('contenido del release (congelado)', () => {
  const row = (manifest: any) => ({
    manifest_jsonb: manifest, scoring_model_version: '1.0.0', version: 'v1',
    consultation_slug: 'live-slug', consultation_title: 'Título en vivo', consultation_description: null
  })

  it('con content en el manifiesto NO consulta las tablas editables', async () => {
    const query = vi.fn()
    const frozen = { questions: [{ questionId: 'q1', canonicalText: 'congelada' }], entities: [], positions: [{ value: 2 }], dimensions: [] }
    const out = await buildReleasePayload(query, 'rid', row({ consultation: { slug: 's', title: 'T', description: 'D' }, content: frozen }))
    expect(query).not.toHaveBeenCalled()
    expect(out.frozen).toBe(true)
    expect(out.questions[0].canonicalText).toBe('congelada')
    expect(out.consultation).toEqual({
      slug: 's', title: 'T', description: 'D',
      // Sin ajustes congelados ni metadata, la encuesta se comporta como la del 29N
      kind: 'current', shortName: null, entityNoun: { singular: 'partido', plural: 'partidos' }, minEvaluableQuestions: null
    })
  })

  it('sin content (releases antiguos) lee en vivo', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    const out = await buildReleasePayload(query, 'rid', row({ version: 'demo' }))
    expect(query).toHaveBeenCalled()
    expect(out.frozen).toBe(false)
    expect(out.consultation.slug).toBe('live-slug')
  })

  it('las posiciones llevan todas las citas aprobadas y descartan el resumen genérico del extractor', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // preguntas
      .mockResolvedValueOnce({ rows: [] }) // entidades
      .mockResolvedValueOnce({ rows: [{
        entity_id: 'e', question_id: 'q', value: 1, categorical_value: null, stance_status: 'approved', conditions: null,
        evidence_summary: '2 claims extraídos del programa electoral', not_comparable_reason: null, claim_id: null,
        evidence_jsonb: [{ literal_text: 'cita A', source_page: 3 }, { literal_text: 'cita B', source_page: 4 }],
        claim_text: null, claim_page: null, source_title: 'Programa X'
      }] })
      .mockResolvedValueOnce({ rows: [] }) // dimensiones
    const c = await loadReleaseContent(query, 'rid')
    expect(c.positions[0].evidence).toEqual([{ text: 'cita A', page: 3, translation: null }, { text: 'cita B', page: 4, translation: null }])
    expect(c.positions[0].claimText).toBe('cita A')
    expect(c.positions[0].evidenceSummary).toBeNull()
    expect(c.positions[0].sourceTitle).toBe('Programa X')
  })
})

describe('selección dinámica de preguntas', () => {
  const ents = ['A', 'B', 'C', 'D'].map((n) => ({ entityId: n.toLowerCase(), name: n }))
  const dims = ['eco', 'soc', 'ter']
  const qs: any[] = []
  const pos: any[] = []
  for (let i = 0; i < 60; i++) {
    qs.push({ questionId: `q${i}`, dimensionCode: dims[i % 3], themeCode: `t${i}`, regionalParties: i === 58 ? ['C'] : i === 59 ? ['D'] : [] })
    for (const e of ents) if (i % 4 !== 3 || e.entityId === 'a' || e.entityId === 'b') pos.push({ entityId: e.entityId, questionId: `q${i}`, value: ((i + e.entityId.charCodeAt(0)) % 5) - 2, stanceStatus: 'approved' })
  }
  const ids = (r: any[]) => r.map((q) => q.questionId)

  it('respeta el objetivo por profundidad y no supera lo que cubren los partidos', () => {
    const generales = (m: 'normal' | 'quick') => selectQuestions(qs, pos, ents, ['a', 'b', 'c', 'd'], m).filter((q: any) => !q.regionalParties?.length).length
    expect(generales('normal')).toBe(TARGET_QUESTIONS.normal)
    expect(generales('quick')).toBe(TARGET_QUESTIONS.quick)
    expect(selectQuestions(qs, pos, ents, ['c'], 'deep').length).toBeLessThanOrEqual(45) // c no tiene posición en 1 de cada 4
  })
  it('solo salen preguntas con posición de algún partido elegido', () => {
    const r = ids(selectQuestions(qs, pos, ents, ['c'], 'deep'))
    for (const id of r) expect(pos.some((p) => p.entityId === 'c' && p.questionId === id)).toBe(true)
  })
  it('las regionales solo salen si se elige su partido', () => {
    expect(ids(selectQuestions(qs, pos, ents, ['a', 'b'], 'normal'))).not.toContain('q58')
    expect(ids(selectQuestions(qs, pos, ents, ['a', 'c'], 'quick'))).toContain('q58')
    expect(ids(selectQuestions(qs, pos, ents, ['a', 'c', 'd'], 'quick'))).toContain('q58')
  })
  it('una pregunta con posición de un solo partido sale cuando se elige ese partido y se suma al total', () => {
    const soloQs = [
      { questionId: 's1', dimensionCode: 'eco', themeCode: 't1', regionalParties: [] },
      { questionId: 's2', dimensionCode: 'eco', themeCode: 't2', regionalParties: [] },
      { questionId: 's3', dimensionCode: 'soc', themeCode: 't3', regionalParties: [] }
    ]
    const soloPos = [
      { entityId: 'a', questionId: 's1', value: 2, stanceStatus: 'approved' },
      { entityId: 'b', questionId: 's1', value: -2, stanceStatus: 'approved' },
      { entityId: 'a', questionId: 's2', value: 2, stanceStatus: 'approved' },
      { entityId: 'a', questionId: 's3', value: 2, stanceStatus: 'approved' },
      { entityId: 'b', questionId: 's3', value: 1, stanceStatus: 'approved' }
    ]
    // s2 solo tiene posición de 'a': sale si se elige 'a' (sola o con otros), por decisión editorial
    expect(ids(selectQuestions(soloQs, soloPos, ents, ['a', 'b'], 'deep'))).toContain('s2')
    expect(ids(selectQuestions(soloQs, soloPos, ents, ['a'], 'deep'))).toContain('s2')
    // y no sale si no se elige 'a'
    expect(ids(selectQuestions(soloQs, soloPos, ents, ['b'], 'deep'))).not.toContain('s2')
  })
  it('una regional con posición de un solo partido sí sale si se elige ese partido', () => {
    const rq = [
      { questionId: 'g1', dimensionCode: 'x', themeCode: 'g', regionalParties: ['Galicia'] },
      { questionId: 'o1', dimensionCode: 'x', themeCode: 'o' }, { questionId: 'o2', dimensionCode: 'x', themeCode: 'p' }
    ] as any[]
    const re = [{ entityId: 'bng', name: 'Galicia' }, { entityId: 'psoe', name: 'PSOE' }] as any[]
    const rp = [
      { entityId: 'bng', questionId: 'g1', value: 2, stanceStatus: 'approved' },
      { entityId: 'bng', questionId: 'o1', value: 1, stanceStatus: 'approved' }, { entityId: 'psoe', questionId: 'o1', value: 1, stanceStatus: 'approved' },
      { entityId: 'bng', questionId: 'o2', value: 1, stanceStatus: 'approved' }, { entityId: 'psoe', questionId: 'o2', value: -1, stanceStatus: 'approved' }
    ]
    expect(ids(selectQuestions(rq, rp, re, ['bng', 'psoe'], 'normal'))).toContain('g1')
    expect(ids(selectQuestions(rq, rp, re, ['psoe'], 'normal'))).not.toContain('g1')
  })
  it('entran todas las regionales de los partidos elegidos, sin tope', () => {
    const rq = [1, 2, 3, 4].map((i) => ({ questionId: 'r' + i, dimensionCode: 'x', themeCode: 'r' + i, regionalParties: ['P' + i] })) as any[]
    const re = [1, 2, 3, 4].map((i) => ({ entityId: 'e' + i, name: 'P' + i })) as any[]
    const rp = [1, 2, 3, 4].map((i) => ({ entityId: 'e' + i, questionId: 'r' + i, value: 1, stanceStatus: 'approved' }))
    expect(ids(selectQuestions(rq, rp, re, ['e1', 'e2', 'e3', 'e4'], 'quick')).sort()).toEqual(['r1', 'r2', 'r3', 'r4'])
  })
  it('las regionales se suman al objetivo de preguntas generales', () => {
    const base = selectQuestions(qs, pos, ents, ['a', 'b'], 'normal')
    const conRegional = selectQuestions(qs, pos, ents, ['a', 'c'], 'normal')
    const nRegBase = base.filter((q: any) => q.regionalParties?.length).length
    const nRegCon = conRegional.filter((q: any) => q.regionalParties?.length).length
    expect(nRegCon).toBeGreaterThan(nRegBase)
    expect(conRegional.length - nRegCon).toBe(TARGET_QUESTIONS.normal)
  })
  it('reserva un cupo para las preguntas de contrapeso', () => {
    const bq = [
      ...Array.from({ length: 30 }, (_, i) => ({ questionId: 'g' + i, dimensionCode: 'x', themeCode: 'g' + i })),
      ...Array.from({ length: 5 }, (_, i) => ({ questionId: 'b' + i, dimensionCode: 'x', themeCode: 'bal-' + i }))
    ] as any[]
    const be = [{ entityId: 'p1', name: 'P1' }, { entityId: 'p2', name: 'P2' }, { entityId: 'p3', name: 'P3' }] as any[]
    const bp: any[] = []
    for (const q of bq) for (const e of be) {
      // las de contrapeso solo las contesta uno de cada tres partidos, y las generales todos
      if (q.questionId.startsWith('g') || e.entityId === 'p1' || e.entityId === 'p2') bp.push({ entityId: e.entityId, questionId: q.questionId, value: 1, stanceStatus: 'approved' })
    }
    const sel = selectQuestions(bq, bp, be, ['p1', 'p2', 'p3'], 'quick')
    expect(sel.filter((q: any) => q.themeCode.startsWith('bal-')).length).toBe(Math.round(TARGET_QUESTIONS.quick * 0.2))
    expect(sel.length).toBe(TARGET_QUESTIONS.quick)
  })
  it('reparte por dimensiones y es determinista', () => {
    const r = selectQuestions(qs, pos, ents, ['a', 'b', 'c', 'd'], 'quick')
    const count = (d: string) => r.filter((q) => q.dimensionCode === d).length
    expect(Math.max(...dims.map(count)) - Math.min(...dims.map(count))).toBeLessThanOrEqual(2)
    expect(ids(selectQuestions(qs, pos, ents, ['a', 'b', 'c', 'd'], 'quick'))).toEqual(ids(r))
  })
  it('las posiciones excluidas del cálculo no cuentan', () => {
    const only = [{ entityId: 'a', questionId: 'q0', value: null, stanceStatus: 'ambiguous' }]
    expect(selectQuestions(qs, only, ents, ['a'], 'normal')).toEqual([])
  })
})

describe('respuestas sin opinión', () => {
  it('«No sé» (0), sin tocar y omitidas no cuentan; el resto sí', () => {
    const qs = [{ questionId: 'a' }, { questionId: 'b' }, { questionId: 'c' }, { questionId: 'd' }, { questionId: 'e' }]
    const r = buildAnswerArray(qs, { a: 2, b: 0, c: -1, d: 1 }, new Set(['d']))
    expect(r.map((x) => x.skipped)).toEqual([false, true, false, true, true])
    expect(r.find((x) => x.questionId === 'c')!.value).toBe(-1)
  })
  it('quien contesta «No sé» a todo no puntúa a nadie', () => {
    const qs = [{ questionId: 'a' }, { questionId: 'b' }]
    expect(buildAnswerArray(qs, { a: 0, b: 0 }, new Set()).every((x) => x.skipped)).toBe(true)
  })
})
