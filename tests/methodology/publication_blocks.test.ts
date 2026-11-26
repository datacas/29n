import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { checkContent, checkSignDiscrepancies, programPages, verifyQuote } from '../../scripts/release/publication_blocks'

/** Bloqueos de publicación (#53). Los que dependen del PDF se saltan si no hay `pdftotext` instalado. */
const hasPdf = (() => { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true } catch { return false } })()
const REAL_PP = 'Reformaremos la Ley del Menor para que en delitos graves cometidos con violencia, armas o en el seno de bandas o grupos organizados se incremente el tiempo de internamiento en centros cerrados, acompañado de formación y educación.'
const REAL_COMPROMIS = "Treballarem per la construcció d'una Unió Europea de la Defensa que puga substituir el marc de l'OTAN, reduïsca duplicitats i despeses militars sense comprometre la seguretat amb un mandat clar en favor del manteniment de la 53"
const reg = (items: any = {}, audited: string[] = ['Q1']) => ({ items, audited })
const Q = [{ id: 'q1', code: 'Q1' }]
const pos = (text: string | null, page: number | null, party = 'PP') => ({ party, questionId: 'q1', value: 1, evidence: [{ text, page }] })

describe.skipIf(!hasPdf)('Cita contra el PDF original', () => {
  it('cita auténtica en su página: verificable', () => { expect(verifyQuote(REAL_PP, 16, programPages('PP')!)).toBe('ok') })
  it('cita inventada: no verificable', () => { expect(verifyQuote('Aboliremos todas las competencias autonómicas en un plazo de seis meses sin excepción alguna', 16, programPages('PP')!)).toBe('no_encontrada') })
  it('cita auténtica pero en otra página: solo aviso', () => { expect(verifyQuote(REAL_PP, 60, programPages('PP')!)).toBe('otra_pagina') })
  it('tolera números de página intercalados y palabras partidas por el PDF', () => { expect(verifyQuote(REAL_COMPROMIS, 54, programPages('Compromís')!)).toBe('ok') })
  it('bloquea la celda con la cita inventada y dice cuál y por qué', () => {
    const r = checkContent(Q, [pos('Aboliremos todas las competencias autonómicas en un plazo de seis meses sin excepción alguna', 16)], reg())
    expect(r.blocks).toHaveLength(1); expect(r.blocks[0]).toMatch(/PP · Q1: cita no verificable en el PDF \(p\. 16\)/)
  })
  it('la cita auténtica no bloquea; en otra página solo avisa', () => {
    expect(checkContent(Q, [pos(REAL_PP, 16)], reg()).blocks).toEqual([])
    const r = checkContent(Q, [pos(REAL_PP, 60)], reg()); expect(r.blocks).toEqual([]); expect(r.warnings.join()).toMatch(/página distinta/)
  })
})

describe('Respaldo documental', () => {
  it('posición con valor y sin cita utilizable (sin página o muy corta): bloquea', () => {
    expect(checkContent(Q, [pos(REAL_PP, null)], reg()).blocks[0]).toMatch(/sin respaldo documental suficiente/)
    expect(checkContent(Q, [pos('corta', 12)], reg()).blocks[0]).toMatch(/PP · Q1: sin respaldo/)
  })
  it('una posición sin valor no se comprueba', () => { expect(checkContent(Q, [{ ...pos(null, null), value: null }], reg()).blocks).toEqual([]) })
})

describe('Ítems sin atomicidad o sin dirección', () => {
  it('doble contenido o sin dirección, sin justificar: bloquea; con justificación: pasa', () => {
    expect(checkContent(Q, [], reg({ Q1: { verdict: 'compound' } })).blocks[0]).toMatch(/Q1: ítem sin atomicidad/)
    expect(checkContent(Q, [], reg({ Q1: { verdict: 'no_direction' } })).blocks[0]).toMatch(/sin dirección/)
    expect(checkContent(Q, [], reg({ Q1: { verdict: 'compound', justified: true } })).blocks).toEqual([])
  })
  it('una pregunta sin auditar avisa pero no bloquea', () => {
    const r = checkContent(Q, [], reg({}, [])); expect(r.blocks).toEqual([]); expect(r.warnings.join()).toMatch(/sin registro/)
  })
})

describe('Discrepancias de signo sin adjudicar', () => {
  it('sin tablas de evaluación solo avisa', async () => {
    const r = await checkSignDiscrepancies(async () => ({ rows: [{ ok: false }] }), Q); expect(r.blocks).toEqual([]); expect(r.warnings[0]).toMatch(/No se comprobaron/)
  })
  it('una celda con signos opuestos y sin adjudicar bloquea con celda y motivo', async () => {
    let n = 0
    const r = await checkSignDiscrepancies(async () => (n++ === 0 ? { rows: [{ ok: true }] } : { rows: [{ question_id: 'q1', party: 'PP' }] }), Q)
    expect(r.blocks).toEqual(['PP · Q1: discrepancia de signo entre evaluadores sin adjudicar'])
  })
})
