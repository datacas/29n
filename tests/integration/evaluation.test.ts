/**
 * Evaluación humana ciega (piloto, D21): ceguera, autorización, guardado automático, concurrencia, finalización irreversible,
 * inmutabilidad, contexto adicional versionado y auditoría. Contra PostgreSQL real (BD de pruebas `affinity_test`, migraciones 001–010).
 * Los fixtures usan nombres únicos y no se borran (`position_codings` y la auditoría son de solo añadir).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import {
  EvalError, getProvenance, resolveEvaluator, listCampaigns, listCells, getCell, saveDraft, finalizeEvaluation, requestContext, resolveContextRequest
} from '../../app/server/utils/evaluation'
import { listQueue, getAdjudication, saveAdjudication } from '../../app/server/utils/adjudication'

let pool: Pool
beforeAll(() => { pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity_test' }) })
afterAll(async () => { await pool.end() })

const SECRET_PARTY = () => `ZZ_PARTIDO_SECRETO_${randomUUID().slice(0, 8)}`
const q = (t: string, p?: unknown[]) => pool.query(t, p)

async function fail(p: Promise<unknown>, status: number) {
  try { await p } catch (e: any) { expect(e).toBeInstanceOf(EvalError); expect(e.status).toBe(status); return e }
  throw new Error(`Se esperaba EvalError ${status}`)
}

/** Crea evaluador + campaña + una celda con 3 pasajes (páginas 5, 6 y 9) y contexto adicional precalculado (páginas 4, 5 y 7). */
async function fixture(opts: { status?: string; kind?: string } = {}) {
  const partyName = SECRET_PARTY()
  const { rows: [ent] } = await q(`INSERT INTO entities (name, type, is_historical) VALUES ($1,'party',false) RETURNING id`, [partyName])
  
  const { rows: [qs] } = await q(`INSERT INTO questions (canonical_text, answer_type, status) VALUES ($1,'scale','draft') RETURNING id`, [`Pregunta ${randomUUID()}`])
  const { rows: [cred] } = await q(`INSERT INTO admin_credentials (email) VALUES ($1) RETURNING id`, [`eval-${randomUUID()}@test.local`])
  const label = `Evaluador test ${randomUUID().slice(0, 8)}`
  const { rows: [ev] } = await q(`INSERT INTO eval_evaluators (label, affiliation, credential_id) VALUES ($1,'internal',$2) RETURNING id, label, affiliation`, [label, cred.id])
  const { rows: [camp] } = await q(
    `INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note) VALUES ($1,$2,$3,'0.1-test','manual','dirigida','sesgo') RETURNING id`,
    [`Camp ${randomUUID()}`, opts.kind ?? 'pilot', opts.status ?? 'open'])
  const { rows: [cell] } = await q(`INSERT INTO eval_cells (campaign_id, ord, question_id, entity_id, blind_label, party_name, extra_context) VALUES ($1,1,$2,$3,'Partido A',$4,$5) RETURNING id`,
    [camp.id, qs.id, ent.id, partyName, JSON.stringify([{ page: 4, text: 'texto página 4' }, { page: 5, text: 'texto página 5' }, { page: 7, text: 'texto página 7' }])])
  const snap = { item: 'Ítem de prueba', context: 'Contexto de prueba', language: 'es', passages: [{ page: 5, text: 'texto página 5' }, { page: 6, text: 'texto página 6' }, { page: 9, text: 'texto página 9' }] }
  await q(`INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ($1,1,$2,'sha1','inicial')`, [cell.id, JSON.stringify(snap)])
  await q('INSERT INTO eval_assignments (cell_id, evaluator_id) VALUES ($1,$2)', [cell.id, ev.id])
  return { partyName, ent: ent.id as string, question: qs.id as string, cred: cred.id as string, ev: ev as { id: string; label: string; affiliation: 'internal' }, camp: camp.id as string, cell: cell.id as string }
}

type F = Awaited<ReturnType<typeof fixture>>
const complete = (f: F, over: Record<string, unknown> = {}) => ({
  documentClass: 'supports' as const, intensity: 2, selectedEvidence: [0], rationale: 'Compromiso claro', insufficientContext: false, cellVersion: 1, ...over
})

describe('Ceguera desde el backend', () => {
  it('ninguna respuesta de evaluación incluye el partido, la referencia ni respuestas de IA o de otros evaluadores', async () => {
    const f = await fixture()
    // Una respuesta de IA y una evaluación de OTRO humano sobre la misma celda, con marcas que no deben aparecer nunca.
    await q(`INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity, rationale)
             VALUES ($1,$2,$3,'ai','Modelo-IA-SECRETO','h','ok','opposes',-2,'RESPUESTA_IA_SECRETA')`, [randomUUID(), f.ent, f.question])
    await q(`INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity, rationale)
             VALUES ($1,$2,$3,'human','Otro humano SECRETO','h','ok','supports',1,'EVALUACION_AJENA_SECRETA')`, [randomUUID(), f.ent, f.question])
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f))
    const blob = JSON.stringify({
      campaigns: await listCampaigns(pool, f.ev as any),
      cells: await listCells(pool, f.ev as any, f.camp),
      cell: await getCell(pool, f.ev as any, f.camp, f.cell)
    })
    for (const forbidden of [f.partyName, 'Modelo-IA-SECRETO', 'RESPUESTA_IA_SECRETA', 'Otro humano SECRETO', 'EVALUACION_AJENA_SECRETA', f.ent, 'party_name', 'reference']) {
      expect(blob).not.toContain(forbidden)
    }
    expect(Object.keys(await getCell(pool, f.ev as any, f.camp, f.cell)).sort()).toEqual(
      ['blindLabel', 'campaignStatus', 'cellId', 'context', 'contextRequest', 'draft', 'item', 'manualText', 'manualVersion', 'ord', 'passages', 'version'])
  })

  it('no preselecciona clase ni intensidad: sin borrador no hay valores, y el borrador nuevo nace vacío', async () => {
    const f = await fixture()
    expect((await getCell(pool, f.ev as any, f.camp, f.cell)).draft).toBeNull()
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, { rationale: 'solo notas', cellVersion: 1 })
    const d = (await getCell(pool, f.ev as any, f.camp, f.cell)).draft!
    expect(d.documentClass).toBeNull(); expect(d.intensity).toBeNull(); expect(d.insufficientContext).toBe(false); expect(d.selectedEvidence).toEqual([])
  })
})

describe('Autorización', () => {
  it('un evaluador no asignado recibe 404 idéntico al de una celda inexistente (sin filtrar su existencia)', async () => {
    const f = await fixture(); const g = await fixture()
    const e1 = await fail(getCell(pool, g.ev as any, f.camp, f.cell), 404)
    const e2 = await fail(getCell(pool, g.ev as any, f.camp, randomUUID()), 404)
    expect(e1.message).toBe(e2.message)
    await fail(saveDraft(pool, g.ev as any, f.camp, f.cell, 0, complete(f)), 404)
    await fail(finalizeEvaluation(pool as any, g.ev as any, f.camp, f.cell, 1, 1), 404)
    await fail(requestContext(pool, g.ev as any, f.camp, f.cell, 'x'), 404)
    await fail(listCells(pool, g.ev as any, f.camp), 404)
    expect(await listCampaigns(pool, g.ev as any)).not.toContainEqual(expect.objectContaining({ id: f.camp }))
  })

  it('una celda pedida con otra campaña no se devuelve', async () => {
    const f = await fixture(); const g = await fixture()
    await fail(getCell(pool, f.ev as any, g.camp, f.cell), 404)
  })

  it('un evaluador desactivado no puede operar', async () => {
    const f = await fixture()
    await q('UPDATE eval_evaluators SET active = false WHERE id = $1', [f.ev.id])
    await fail(resolveEvaluator(pool, f.cred), 403)
  })

  it('la identidad se resuelve a partir de la credencial y es estable', async () => {
    const f = await fixture()
    const a = await resolveEvaluator(pool, f.cred); const b = await resolveEvaluator(pool, f.cred)
    expect(a.id).toBe(f.ev.id); expect(b.id).toBe(a.id); expect(a.affiliation).toBe('internal')
  })

  it('el evaluador interno por defecto se crea una vez y no se reasigna a otra credencial', async () => {
    await q(`UPDATE eval_evaluators SET credential_id = NULL WHERE label = 'Humano interno 1'`)
    const { rows: [c1] } = await q(`INSERT INTO admin_credentials (email) VALUES ($1) RETURNING id`, [`a-${randomUUID()}@test.local`])
    const { rows: [c2] } = await q(`INSERT INTO admin_credentials (email) VALUES ($1) RETURNING id`, [`b-${randomUUID()}@test.local`])
    const first = await resolveEvaluator(pool, c1.id)
    expect(first.label).toBe('Humano interno 1')
    await fail(resolveEvaluator(pool, c2.id), 403)
    await q(`UPDATE eval_evaluators SET credential_id = NULL WHERE label = 'Humano interno 1'`)
  })

  it('con la campaña cerrada no se guarda, no se finaliza ni se pide contexto', async () => {
    const f = await fixture({ status: 'closed' })
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f)), 409)
    await fail(requestContext(pool, f.ev as any, f.camp, f.cell, 'x'), 409)
  })
})

describe('Guardado automático y concurrencia', () => {
  it('versiona cada guardado y rechaza versiones obsoletas', async () => {
    const f = await fixture()
    const a = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { documentClass: null, intensity: null }))
    expect(a.version).toBe(1)
    const b = await saveDraft(pool, f.ev as any, f.camp, f.cell, 1, complete(f, { rationale: 'v2' }))
    expect(b.version).toBe(2)
    const e = await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 1, complete(f, { rationale: 'obsoleto' })), 409)
    expect(e.extra).toMatchObject({ currentVersion: 2 })
    expect((await getCell(pool, f.ev as any, f.camp, f.cell)).draft!.rationale).toBe('v2')
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f)), 409)   // crear de nuevo cuando ya existe
  })

  it('dos guardados simultáneos con la misma versión: solo uno prospera', async () => {
    const f = await fixture()
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f))
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => saveDraft(pool, f.ev as any, f.camp, f.cell, 1, complete(f, { rationale: `edición ${i}` }))))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected').every((r: any) => r.reason instanceof EvalError && r.reason.status === 409)).toBe(true)
  })

  it('valida clase, intensidad coherente y evidencias existentes', async () => {
    const f = await fixture()
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { documentClass: 'conditional' })), 400)
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { documentClass: 'supports', intensity: -1 })), 400)
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { selectedEvidence: [7] })), 400)
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { cellVersion: 99 })), 409)
  })

  it('recuperación: tras recargar se recupera el borrador guardado', async () => {
    const f = await fixture()
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { documentClass: 'opposes', intensity: -1, rationale: 'recuperable' }))
    const d = (await getCell(pool, f.ev as any, f.camp, f.cell)).draft!
    expect(d).toMatchObject({ documentClass: 'opposes', intensity: -1, rationale: 'recuperable', selectedEvidence: [0], version: 1, finalized: false })
    expect((await listCells(pool, f.ev as any, f.camp))[0].status).toBe('draft')
  })
})

describe('Finalización irreversible y position_codings', () => {
  it('exige conclusión completa antes de finalizar', async () => {
    const f = await fixture()
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, 1, 1), 409)   // sin borrador
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, { cellVersion: 1 })
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, 1, 1), 422)   // sin clase ni insuficiencia
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 1, { documentClass: 'supports', cellVersion: 1, selectedEvidence: [0], rationale: 'x' })
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, 2, 1), 422)   // falta intensidad
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 2, { documentClass: 'supports', intensity: 1, cellVersion: 1, selectedEvidence: [], rationale: 'x' })
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, 3, 1), 422)   // falta evidencia
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 3, { documentClass: 'supports', intensity: 1, cellVersion: 1, selectedEvidence: [0], rationale: '  ' })
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, 4, 1), 422)   // falta justificación
    const { rows } = await q('SELECT 1 FROM position_codings WHERE campaign_id = $1', [f.camp])
    expect(rows).toHaveLength(0)
  })

  it('finaliza en position_codings (humano interno, no independiente, ciego) y bloquea el borrador', async () => {
    const f = await fixture()
    await q(`INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity)
             VALUES ($1,$2,$3,'ai','Modelo X','h','ok','supports',1)`, [randomUUID(), f.ent, f.question])
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { selectedEvidence: [0, 2] }))
    const { codingId } = await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)
    const { rows: [c] } = await q('SELECT * FROM position_codings WHERE id = $1', [codingId])
    expect(c).toMatchObject({ evaluator_kind: 'human', evaluator_label: f.ev.label, blind: true, execution_status: 'ok', document_class: 'supports', intensity: 2, insufficient_context: false, revision: 1, cell_version: 1, campaign_id: f.camp, evaluator_id: f.ev.id, run_id: f.camp })
    expect(c.config).toMatchObject({ affiliation: 'internal', independent_human_reference: false, cell_version: 1 })
    expect(c.independent_of).toEqual(['Modelo X'])
    expect(c.evidence).toEqual([{ index: 0, page: 5, text: 'texto página 5' }, { index: 2, page: 9, text: 'texto página 9' }])
    expect((await listCells(pool, f.ev as any, f.camp))[0].status).toBe('finalized')
    // irreversible
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, s.version, complete(f, { rationale: 'cambio' })), 409)
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1), 409)
    await fail(requestContext(pool, f.ev as any, f.camp, f.cell, 'x'), 409)
    await expect(q('UPDATE eval_drafts SET rationale = $1 WHERE cell_id = $2', ['x', f.cell])).rejects.toThrow(/finalizada/)
    await expect(q('DELETE FROM eval_drafts WHERE cell_id = $1', [f.cell])).rejects.toThrow()
  })

  it('position_codings es inmutable también para las evaluaciones humanas', async () => {
    const f = await fixture()
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f))
    const { codingId } = await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)
    await expect(q('UPDATE position_codings SET document_class = $1 WHERE id = $2', ['opposes', codingId])).rejects.toThrow()
    await expect(q('DELETE FROM position_codings WHERE id = $1', [codingId])).rejects.toThrow()
    await expect(q('TRUNCATE position_codings')).rejects.toThrow()
  })

  it('finalizaciones concurrentes: solo se registra una fila', async () => {
    const f = await fixture()
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f))
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)))
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect((await q('SELECT 1 FROM position_codings WHERE campaign_id = $1', [f.camp])).rows).toHaveLength(1)
  })

  it('explicit_neutral fija la intensidad 0; not_mentioned no exige evidencia ni justificación', async () => {
    const f1 = await fixture(); const f2 = await fixture()
    const s1 = await saveDraft(pool, f1.ev as any, f1.camp, f1.cell, 0, complete(f1, { documentClass: 'explicit_neutral', intensity: null }))
    const { codingId: c1 } = await finalizeEvaluation(pool as any, f1.ev as any, f1.camp, f1.cell, s1.version, 1)
    expect((await q('SELECT intensity FROM position_codings WHERE id = $1', [c1])).rows[0].intensity).toBe(0)
    const s2 = await saveDraft(pool, f2.ev as any, f2.camp, f2.cell, 0, { documentClass: 'not_mentioned', cellVersion: 1 })
    const { codingId: c2 } = await finalizeEvaluation(pool as any, f2.ev as any, f2.camp, f2.cell, s2.version, 1)
    expect((await q('SELECT document_class, intensity, execution_status FROM position_codings WHERE id = $1', [c2])).rows[0]).toEqual({ document_class: 'not_mentioned', intensity: null, execution_status: 'ok' })
  })

  it('«contexto insuficiente» sin puntuar es una conclusión válida: estado técnico ok, sin clase', async () => {
    const f = await fixture()
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, { insufficientContext: true, rationale: 'falta el capítulo de vivienda', cellVersion: 1 })
    const { codingId } = await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)
    const { rows: [c] } = await q('SELECT execution_status, document_class, intensity, insufficient_context FROM position_codings WHERE id = $1', [codingId])
    expect(c).toEqual({ execution_status: 'ok', document_class: null, intensity: null, insufficient_context: true })
  })

  it('repetibilidad: una campaña nueva sobre la misma celda añade una fila y conserva la original', async () => {
    const f = await fixture()
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f))
    const { codingId: first } = await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)
    const { rows: [camp2] } = await q(`INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note, source_campaign_id)
      VALUES ($1,'repeatability','open','0.1-test','m','aleatoria','—',$2) RETURNING id`, [`Rep ${randomUUID()}`, f.camp])
    const { rows: [cell2] } = await q(`INSERT INTO eval_cells (campaign_id, ord, question_id, entity_id, blind_label, party_name) VALUES ($1,1,$2,$3,'Partido Z',$4) RETURNING id`, [camp2.id, f.question, f.ent, f.partyName])
    await q(`INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) SELECT $1, 1, snapshot, sha256, 'repetición' FROM eval_cell_versions WHERE cell_id = $2 AND version = 1`, [cell2.id, f.cell])
    await q('INSERT INTO eval_assignments (cell_id, evaluator_id) VALUES ($1,$2)', [cell2.id, f.ev.id])
    // la repetición no ve la respuesta anterior
    expect(JSON.stringify(await getCell(pool, f.ev as any, camp2.id, cell2.id))).not.toContain(first)
    const s2 = await saveDraft(pool, f.ev as any, camp2.id, cell2.id, 0, complete(f, { documentClass: 'opposes', intensity: -1 }))
    const { codingId: second } = await finalizeEvaluation(pool as any, f.ev as any, camp2.id, cell2.id, s2.version, 1)
    expect(second).not.toBe(first)
    const { rows } = await q('SELECT document_class FROM position_codings WHERE evaluator_id = $1 AND question_id = $2 ORDER BY created_at', [f.ev.id, f.question])
    expect(rows.map((r) => r.document_class)).toEqual(['supports', 'opposes'])
  })
})

describe('Contexto adicional versionado', () => {
  it('pedir contexto no obliga a puntuar; ampliarlo crea una versión nueva sin tocar la original', async () => {
    const f = await fixture()
    const before = JSON.stringify((await q('SELECT snapshot, sha256 FROM eval_cell_versions WHERE cell_id = $1 AND version = 1', [f.cell])).rows[0])
    const r = await requestContext(pool, f.ev as any, f.camp, f.cell, 'necesito las páginas contiguas')
    expect(r.updated).toBe(false)
    expect((await requestContext(pool, f.ev as any, f.camp, f.cell, 'precisión')).updated).toBe(true)   // una sola petición abierta
    expect((await getCell(pool, f.ev as any, f.camp, f.cell)).draft).toBeNull()                          // sin puntuación
    expect((await listCells(pool, f.ev as any, f.camp))[0].contextRequestOpen).toBe(true)

    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { selectedEvidence: [1] }))
    const res = await resolveContextRequest(pool, f.ev as any, f.camp, f.cell)
    expect(res).toMatchObject({ version: 2 }); expect(res.added).toBeGreaterThan(0)
    // versión 1 intacta e inmutable
    expect(JSON.stringify((await q('SELECT snapshot, sha256 FROM eval_cell_versions WHERE cell_id = $1 AND version = 1', [f.cell])).rows[0])).toBe(before)
    await expect(q('UPDATE eval_cell_versions SET snapshot = $1 WHERE cell_id = $2', ['{}', f.cell])).rejects.toThrow()
    const cell = await getCell(pool, f.ev as any, f.camp, f.cell)
    expect(cell.version).toBe(2)
    expect(cell.passages.slice(0, 3).map((p) => p.page)).toEqual([5, 6, 9])           // las posiciones previas se conservan
    expect(cell.passages.map((p) => p.page)).toEqual(expect.arrayContaining([4, 7]))   // páginas contiguas añadidas
    expect(cell.passages).toHaveLength(5)                                                  // 3 originales + 2 nuevos (el pasaje repetido no se duplica)
    expect(cell.contextRequest).toMatchObject({ status: 'resolved', resolvedVersion: 2 })
    // el borrador anterior exige revisar la nueva versión antes de seguir
    await fail(saveDraft(pool, f.ev as any, f.camp, f.cell, s.version, complete(f, { cellVersion: 1 })), 409)
    await fail(finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1), 409)
    const s2 = await saveDraft(pool, f.ev as any, f.camp, f.cell, s.version, complete(f, { selectedEvidence: [1], cellVersion: 2 }))
    const { codingId } = await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s2.version, 2)
    expect((await q('SELECT cell_version FROM position_codings WHERE id = $1', [codingId])).rows[0].cell_version).toBe(2)
  })

  it('no ampliar sin petición abierta', async () => {
    const f = await fixture()
    await fail(resolveContextRequest(pool, f.ev as any, f.camp, f.cell), 409)
  })

  it('la ampliación no revela el partido', async () => {
    const f = await fixture()
    await requestContext(pool, f.ev as any, f.camp, f.cell, 'más')
    await resolveContextRequest(pool, f.ev as any, f.camp, f.cell)
    expect(JSON.stringify(await getCell(pool, f.ev as any, f.camp, f.cell))).not.toContain(f.partyName)
  })
})

describe('Auditoría', () => {
  it('registra petición de contexto, ampliación y finalización, y es de solo añadir', async () => {
    const f = await fixture()
    await requestContext(pool, f.ev as any, f.camp, f.cell, 'x')
    await resolveContextRequest(pool, f.ev as any, f.camp, f.cell)
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f, { cellVersion: 2 }))
    await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 2)
    const { rows } = await q('SELECT action FROM eval_audit WHERE cell_id = $1 ORDER BY id', [f.cell])
    expect(rows.map((r) => r.action)).toEqual(['context_requested', 'context_resolved', 'finalize'])
    await expect(q('UPDATE eval_audit SET action = $1 WHERE cell_id = $2', ['x', f.cell])).rejects.toThrow()
    await expect(q('DELETE FROM eval_audit WHERE cell_id = $1', [f.cell])).rejects.toThrow()
  })
})

describe('Adjudicación en sombra', () => {
  const base = { causes: ['omitted_position'], rationale: 'Verificado en el programa original', expectedRevision: 0 }
  async function queued(f: F, finalize = true) {
    await q(`INSERT INTO eval_adjudication_items (cell_id, priority, reasons, dossier) VALUES ($1,1,ARRAY['prueba'],'{"ord":1}')`, [f.cell])
    if (finalize) { const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f)); await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1) }
  }

  it('exige haber finalizado la evaluación propia: sin ella 403 en el servidor y rechazo en la BD', async () => {
    const f = await fixture(); await queued(f, false)
    await fail(getAdjudication(pool, f.ev as any, f.cell), 403)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, base), 403)
    await expect(q(`INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes) VALUES ($1,$2,'x',ARRAY['other'])`, [f.cell, f.ev.id])).rejects.toThrow()
  })

  it('solo las celdas de la cola se adjudican; otro evaluador no puede', async () => {
    const f = await fixture(); const g = await fixture()
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f)); await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, base), 404)           // finalizada pero fuera de la cola
    await queued(g)
    await fail(getAdjudication(pool, f.ev as any, g.cell), 403)                    // ajena: no hay evaluación propia
    expect((await listQueue(pool, f.ev as any)).items).toHaveLength(0)
  })

  it('registra varias causas, justificación, evidencia y versiones; es de solo añadir y con revisiones consecutivas', async () => {
    const f = await fixture(); await queued(f)
    const r1 = await saveAdjudication(pool, f.ev as any, f.cell, { ...base, documentClass: 'opposes', intensity: -1, causes: ['omitted_position', 'intensity_error'], proposedAction: 'add_position', evidence: [{ page: 5, text: 'cita verificada', source: 'programa original' }] })
    expect(r1.revision).toBe(1)
    const r2 = await saveAdjudication(pool, f.ev as any, f.cell, { ...base, expectedRevision: 1, documentClass: 'opposes', intensity: -2, causes: ['intensity_error'] })
    expect(r2.revision).toBe(2)
    const view = await getAdjudication(pool, f.ev as any, f.cell)
    expect(view.history.map((h: any) => h.revision)).toEqual([2, 1])                // la anterior se conserva
    expect(view.history[1]).toMatchObject({ documentClass: 'opposes', intensity: -1, causes: ['omitted_position', 'intensity_error'], proposedAction: 'add_position', manualVersion: '0.1-test', cellVersion: 1, applied: false })
    const { rows: [row] } = await q('SELECT own_coding_id, applied FROM eval_adjudications WHERE cell_id = $1 AND revision = 1', [f.cell])
    expect(row.own_coding_id).toBeTruthy(); expect(row.applied).toBe(false)
    await expect(q('UPDATE eval_adjudications SET rationale = $1 WHERE cell_id = $2', ['x', f.cell])).rejects.toThrow()
    await expect(q('DELETE FROM eval_adjudications WHERE cell_id = $1', [f.cell])).rejects.toThrow()
    const q1 = await listQueue(pool, f.ev as any)
    expect(q1.items[0]).toMatchObject({ status: 'adjudicada', revision: 2, causes: ['intensity_error'] }); expect(q1.causeCounts).toEqual({ intensity_error: 1 })
  })

  it('valida causas (al menos una, del catálogo, «otra» con texto), clase/intensidad coherentes y justificación', async () => {
    const f = await fixture(); await queued(f)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, causes: [] }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, causes: ['mayoria'] }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, causes: ['other'] }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, causes: ['other'], otherCauseText: '  ' }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, documentClass: 'supports', intensity: -1 }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, documentClass: 'supports', intensity: null }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, intensity: 1 }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, rationale: '   ' }), 400)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, { ...base, proposedAction: 'aplicar_ya' }), 400)
    expect((await saveAdjudication(pool, f.ev as any, f.cell, { ...base, causes: ['other'], otherCauseText: 'motivo propio' })).revision).toBe(1)
    // sin resolver: sin clase y con desacuerdo razonable (no se impone ninguna mayoría)
    expect((await saveAdjudication(pool, f.ev as any, f.cell, { ...base, expectedRevision: 1, causes: ['reasonable_disagreement'] })).revision).toBe(2)
  })

  it('revisiones concurrentes o dobles envíos: solo uno prospera', async () => {
    const f = await fixture(); await queued(f)
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => saveAdjudication(pool, f.ev as any, f.cell, base)))
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(r.filter((x) => x.status === 'rejected').every((x: any) => x.reason instanceof EvalError && x.reason.status === 409)).toBe(true)
    await fail(saveAdjudication(pool, f.ev as any, f.cell, base), 409)             // revisión esperada obsoleta
  })

  it('no altera positions ni las evaluaciones originales (en sombra, applied=false)', async () => {
    const f = await fixture(); await queued(f)
    const snap = async () => (await q(`SELECT (SELECT count(*) FROM positions)::int AS p, (SELECT md5(coalesce(string_agg(p::text, '|' ORDER BY id::text), '')) FROM positions p) AS ph,
      (SELECT md5(string_agg(c::text, '|' ORDER BY id::text)) FROM position_codings c WHERE evaluator_id = $1) AS ch`, [f.ev.id])).rows[0]
    const before = await snap()
    await saveAdjudication(pool, f.ev as any, f.cell, { ...base, documentClass: 'not_mentioned', causes: ['unsupported_registered_position'], proposedAction: 'remove_registered' })
    expect(await snap()).toEqual(before)
    await expect(q('UPDATE eval_adjudications SET applied = true WHERE cell_id = $1', [f.cell])).rejects.toThrow()
  })
})

describe('Procedencia (no citar como humano lo que no está verificado)', () => {
  it('sin declaración es «unverified»; la última declaración manda y el historial es de solo añadir', async () => {
    const f = await fixture()
    expect((await getProvenance(pool, f.ev.id, f.camp)).evaluation.provenance).toBe('unverified')
    expect((await listCampaigns(pool, f.ev as any))[0].provenance.provenance).toBe('unverified')
    await q(`INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) VALUES ($1,$2,'all','ai_agent','las produjo un agente')`, [f.ev.id, f.camp])
    expect((await getProvenance(pool, f.ev.id, f.camp))).toMatchObject({ evaluation: { provenance: 'ai_agent' }, adjudication: { provenance: 'ai_agent' } })
    await q(`INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) VALUES ($1,$2,'adjudication','human_verified','revisadas por una persona')`, [f.ev.id, f.camp])
    expect((await getProvenance(pool, f.ev.id, f.camp))).toMatchObject({ evaluation: { provenance: 'ai_agent' }, adjudication: { provenance: 'human_verified' } })
    await expect(q('UPDATE eval_provenance SET provenance = $1 WHERE campaign_id = $2', ['human_verified', f.camp])).rejects.toThrow()
    await expect(q('DELETE FROM eval_provenance WHERE campaign_id = $1', [f.camp])).rejects.toThrow()
  })
})

describe('Diseño muestral y autoría', () => {
  it('el evaluador no ve el diseño muestral (muestra R/T, estrato, probabilidad ni peso): ceguera', async () => {
    const f = await fixture()
    await q(`INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, stratum_size, stratum_sampled, inclusion_prob, weight, seed, design_sha256) VALUES ($1,'R','R-negativa','negativa',64,20,0.3125,3.2,1,'sha')`, [f.cell])
    await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f))
    const blob = JSON.stringify({ campaigns: await listCampaigns(pool, f.ev as any), cells: await listCells(pool, f.ev as any, f.camp), cell: await getCell(pool, f.ev as any, f.camp, f.cell) })
    for (const forbidden of ['R-negativa', 'negativa', 'inclusion_prob', 'stratum', 'weight', 'tier', 'design_sha256', '"sample"', '0.3125']) expect(blob).not.toContain(forbidden)
  })

  it('el diseño es inmutable y no admite celdas T con peso ni R sin él', async () => {
    const f = await fixture()
    await expect(q(`INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, design_sha256) VALUES ($1,'R','x','s','x')`, [f.cell])).rejects.toThrow()
    await q(`INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, design_sha256) VALUES ($1,'T','T1','sin_fila','x')`, [f.cell])
    await expect(q('UPDATE eval_sample_design SET sample = $1 WHERE cell_id = $2', ['R', f.cell])).rejects.toThrow()
    await expect(q('DELETE FROM eval_sample_design WHERE cell_id = $1', [f.cell])).rejects.toThrow()
  })

  it('cada evaluación y adjudicación queda con autoría «unverified» hasta que se anote otra (solo añadir); la anotación posterior manda', async () => {
    const f = await fixture()
    await q(`INSERT INTO eval_adjudication_items (cell_id, priority, reasons, dossier) VALUES ($1,1,ARRAY['p'],'{"ord":1}')`, [f.cell])
    const s = await saveDraft(pool, f.ev as any, f.camp, f.cell, 0, complete(f)); const { codingId } = await finalizeEvaluation(pool as any, f.ev as any, f.camp, f.cell, s.version, 1)
    expect((await q(`SELECT author_kind FROM eval_authorship WHERE record_table = 'position_codings' AND record_id = $1`, [codingId])).rows.map((r) => r.author_kind)).toEqual(['unverified'])
    const adj = await saveAdjudication(pool, f.ev as any, f.cell, { causes: ['omitted_position'], rationale: 'x', expectedRevision: 0 })
    let h = (await getAdjudication(pool, f.ev as any, f.cell)).history[0]; expect(h.authorship).toMatchObject({ authorKind: 'unverified' })
    await q(`INSERT INTO eval_authorship (record_table, record_id, author_kind, author_label, authorized_by, note) VALUES ('eval_adjudications', $1, 'ai_agent', 'agente', 'persona responsable', 'registrada bajo autorización expresa')`, [adj.id])
    h = (await getAdjudication(pool, f.ev as any, f.cell)).history[0]; expect(h.authorship).toMatchObject({ authorKind: 'ai_agent', authorizedBy: 'persona responsable' })
    expect((await q(`SELECT count(*)::int AS n FROM eval_authorship WHERE record_id = $1`, [adj.id])).rows[0].n).toBe(2)   // el historial se conserva
    await expect(q(`UPDATE eval_authorship SET author_kind = 'human' WHERE record_id = $1`, [adj.id])).rejects.toThrow()
  })

  it('la ausencia confirmada exige búsqueda en el programa completo y es de solo añadir', async () => {
    const f = await fixture()
    await expect(q(`INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result, search_terms) VALUES ($1,$2,'retrieved_passages','absent_confirmed',ARRAY['x'])`, [f.cell, f.ev.id])).rejects.toThrow()
    await expect(q(`INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result) VALUES ($1,$2,'full_program','absent_confirmed')`, [f.cell, f.ev.id])).rejects.toThrow()
    await q(`INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result, search_terms, pages_reviewed) VALUES ($1,$2,'full_program','absent_confirmed',ARRAY['selectividad'],ARRAY[33])`, [f.cell, f.ev.id])
    await expect(q('DELETE FROM eval_absence_checks WHERE cell_id = $1', [f.cell])).rejects.toThrow()
  })
})
