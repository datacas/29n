/** Panel de métricas: separación IA–IA / humano–IA / humano–humano / repetibilidad y tratamiento de la procedencia. BD de pruebas `affinity_test`; conjunto sintético propio. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { computeMetrics, pairMetrics, groupMetrics } from '../../app/server/utils/metrics'

let pool: Pool
beforeAll(() => { pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity_test' }) })
afterAll(async () => { await pool.end() })
const q = (t: string, p?: unknown[]) => pool.query(t, p)

const CL: [string, number | null][] = [['supports', 2], ['supports', 1], ['opposes', -1], ['opposes', -2], ['not_mentioned', null], ['supports', 2], ['opposes', -1], ['supports', 1], ['not_mentioned', null], ['supports', 2], ['opposes', -2], ['supports', 1]]

async function world(set: string) {
  const { rows: [ent] } = await q(`INSERT INTO entities (name, type, is_historical) VALUES ($1,'party',false) RETURNING id`, [`P-${randomUUID()}`])
  const qs: string[] = []; for (let i = 0; i < CL.length; i++) qs.push((await q(`INSERT INTO questions (canonical_text, answer_type, status) VALUES ($1,'scale','draft') RETURNING id`, [`Q ${randomUUID()}`])).rows[0].id)
  const ai = async (label: string, flip = 0) => { for (let i = 0; i < qs.length; i++) { const [c, n] = CL[i]; const alt = flip && i < flip ? (c === 'supports' ? ['opposes', -1] : ['supports', 1]) : [c, n]
    await q(`INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity, config) VALUES ($1,$2,$3,'ai',$4,'h','ok',$5,$6,$7)`,
      [randomUUID(), ent.id, qs[i], label, alt[0], alt[1], JSON.stringify({ modality: 'B', set, repeat: 1 })]) } }
  return { ent: ent.id as string, qs, ai }
}
async function humanCampaign(w: Awaited<ReturnType<typeof world>>, provenance: string | null, affiliation = 'internal', kind = 'pilot', source: string | null = null, flip = 0) {
  const { rows: [cred] } = await q(`INSERT INTO admin_credentials (email) VALUES ($1) RETURNING id`, [`m-${randomUUID()}@t.local`])
  const label = `Hum ${randomUUID().slice(0, 6)}`
  const { rows: [ev] } = await q(`INSERT INTO eval_evaluators (label, affiliation, credential_id) VALUES ($1,$2,$3) RETURNING id`, [label, affiliation, cred.id])
  const { rows: [camp] } = await q(`INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note, source_campaign_id) VALUES ($1,$2,'open','v','m','s','b',$3) RETURNING id`, [`C ${randomUUID()}`, kind, source])
  if (provenance) await q(`INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) VALUES ($1,$2,'all',$3,'prueba')`, [ev.id, camp.id, provenance])
  for (let i = 0; i < w.qs.length; i++) { const [c, n] = CL[i]; const alt = flip && i < flip ? ['not_mentioned', null] : [c, n]
    await q(`INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity, campaign_id, evaluator_id, config) VALUES ($1,$2,$3,'human',$4,'h','ok',$5,$6,$7,$8,$9)`,
      [camp.id, w.ent, w.qs[i], label, alt[0], alt[1], camp.id, ev.id, JSON.stringify({ affiliation })]) }
  return { label, camp: camp.id as string }
}

describe('Métricas: separación de grupos y procedencia', () => {
  it('IA–IA se calcula sobre el conjunto indicado y es evaluable con ≥10 celdas', async () => {
    const set = `T-${randomUUID()}`; const w = await world(set)
    await w.ai('ia-1'); await w.ai('ia-2'); await w.ai('ia-3', 3)
    const m = await computeMetrics(pool, { set, bootstrap: 50 })
    expect(m.iaIa.evaluadoresCompletos.sort()).toEqual(['ia-1', 'ia-2', 'ia-3'])
    expect(m.iaIa.evaluable).toBe(true)
    expect(m.iaIa.clase.alfaNominal).toBeGreaterThan(0.3); expect(m.iaIa.clase.alfaNominal).toBeLessThan(1)
    expect(m.iaIa.pares).toHaveLength(3)
    expect(m.iaIa.pares.find((p: any) => p.a === 'ia-1' && p.b === 'ia-2').claseExacta).toBe(1)
  })

  it('con menos de 10 celdas: «no evaluable» y sin cifras inventadas', () => {
    const mk = (label: string) => new Map(CL.slice(0, 5).map(([c, n], i) => [`c${i}`, { cell: `c${i}`, label, cls: c, intensity: n }]))
    const g: any = groupMetrics(['a', 'b'], new Map([['a', mk('a')], ['b', mk('b')]]), 20)
    expect(g.evaluable).toBe(false); expect(g.motivo).toMatch(/insuficiente/)
    const p = pairMetrics('a', 'b', [...mk('a').values()].map((x, i) => ({ x, y: [...mk('b').values()][i] })))
    expect(p.evaluable).toBe(false); expect(p.kappaClase).toBeNull()
  })

  it('filas humanas con procedencia «ai_agent» o sin verificar NO cuentan como humanas: salen aparte y etiquetadas', async () => {
    const set = `T-${randomUUID()}`; const w = await world(set); await w.ai('ia-1'); await w.ai('ia-2')
    const agent = await humanCampaign(w, 'ai_agent'); const unver = await humanCampaign(w, null)
    const m: any = await computeMetrics(pool, { set, bootstrap: 20 })
    expect(m.humanoIa.disponible).toBe(false)
    const prov = m.filasHumanasNoVerificadas.map((x: any) => x.procedencia)
    expect(prov).toContain('ai_agent'); expect(prov).toContain('unverified')
    const a = m.filasHumanasNoVerificadas.find((x: any) => x.procedencia === 'ai_agent')
    expect(a.aviso).toMatch(/IA–IA/); expect(a.comoIAvsIA.some((e: any) => e.evaluador === agent.label)).toBe(true)
    expect(m.humanoHumano.disponible).toBe(false)
    expect(JSON.stringify(m.humanoIa)).not.toContain(agent.label); expect(JSON.stringify(m.humanoIa)).not.toContain(unver.label)
  })

  it('humano verificado: aparece como humano–IA (separado de IA–IA) y sin humano–humano si solo hay uno', async () => {
    const set = `T-${randomUUID()}`; const w = await world(set); await w.ai('ia-1'); await w.ai('ia-2')
    const h = await humanCampaign(w, 'human_verified', 'internal', 'pilot', null, 2)
    const m: any = await computeMetrics(pool, { set, bootstrap: 20 })
    expect(m.humanoIa.disponible).toBe(true)
    const ev = m.humanoIa.evaluadores.find((e: any) => e.evaluador === h.label)
    expect(ev.celdas).toBe(CL.length); expect(ev.sinClase).toBe(0)
    expect(ev.frente).toHaveLength(2); expect(ev.frente[0].claseExacta).toBeCloseTo((CL.length - 2) / CL.length, 2)   // las 2 primeras celdas se cambiaron a propósito
    expect(m.humanoIa.nota).toMatch(/no independiente|≠ referencia independiente/i)
    expect(m.humanoHumano.disponible).toBe(false)
  })

  it('humano–humano solo con ≥2 humanos EXTERNOS verificados', async () => {
    const set = `T-${randomUUID()}`; const w = await world(set); await w.ai('ia-1')
    await humanCampaign(w, 'human_verified', 'external'); await humanCampaign(w, 'human_verified', 'external', 'pilot', null, 3)
    const m: any = await computeMetrics(pool, { set, bootstrap: 20 })
    expect(m.humanoHumano.disponible).toBe(true); expect(m.humanoHumano.evaluable).toBe(true)
    expect(m.humanoHumano.pares).toHaveLength(1)
  })

  it('repetibilidad: mismo evaluador verificado, campaña de repetibilidad frente a su origen', async () => {
    const set = `T-${randomUUID()}`; const w = await world(set); await w.ai('ia-1')
    const first = await humanCampaign(w, 'human_verified')
    // la repetición reutiliza el mismo evaluador: se simula insertando codificaciones en una campaña de repetibilidad
    const { rows: [ev] } = await q('SELECT id FROM eval_evaluators WHERE label = $1', [first.label])
    const { rows: [rc] } = await q(`INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note, source_campaign_id) VALUES ($1,'repeatability','open','v','m','s','b',$2) RETURNING id`, [`R ${randomUUID()}`, first.camp])
    await q(`INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) VALUES ($1,$2,'all','human_verified','prueba')`, [ev.id, rc.id])
    for (let i = 0; i < w.qs.length; i++) { const [c, n] = i < 2 ? ['not_mentioned', null] : CL[i]
      await q(`INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity, campaign_id, evaluator_id, config) VALUES ($1,$2,$3,'human',$4,'h','ok',$5,$6,$7,$8,$9)`, [rc.id, w.ent, w.qs[i], first.label, c, n, rc.id, ev.id, JSON.stringify({ affiliation: 'internal' })]) }
    const m: any = await computeMetrics(pool, { set, bootstrap: 20 })
    expect(m.repetibilidad.disponible).toBe(true); expect(m.repetibilidad.nClase).toBe(CL.length); expect(m.repetibilidad.claseExacta).toBeCloseTo((CL.length - 2) / CL.length, 2)
    expect(m.repetibilidad.nota).toMatch(/no equivale/i)
  })

  it('todos los informes llevan las limitaciones', async () => {
    const m = await computeMetrics(pool, { set: `T-${randomUUID()}`, bootstrap: 10 })
    expect(m.limitaciones.join(' ')).toMatch(/dirigidas|sesgo de selección/); expect(m.limitaciones.join(' ')).toMatch(/independiente/)
    expect(m.iaIa.evaluable).toBe(false)
  })
})
