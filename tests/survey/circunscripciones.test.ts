import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import data from '../../app/data/circunscripciones.json' with { type: 'json' }

describe('circunscripciones al Congreso', () => {
  it('52 circunscripciones, sin repetir, cada una con partidos sin duplicar', () => {
    expect(data.circunscripciones).toHaveLength(52)
    expect(new Set(data.circunscripciones.map((c) => c.nombre)).size).toBe(52)
    for (const c of data.circunscripciones) expect(new Set(c.partidos).size, c.nombre).toBe(c.partidos.length)
  })
  it('PP, PSOE y Vox se presentan en todas', () => {
    for (const c of data.circunscripciones) for (const p of ['PP', 'PSOE', 'Vox']) expect(c.partidos, c.nombre).toContain(p)
  })
  // Los nombres deben coincidir con los de las entidades de la encuesta del 29N publicada
  const DIR = 'app/public/data/releases'
  const current = existsSync(DIR)
    ? readdirSync(DIR).filter((f) => /^[0-9a-f-]{36}\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))).find((d) => d.consultation?.kind !== 'historical')
    : null
  it.skipIf(!current)('todos los partidos de la tabla existen en la encuesta del 29N', () => {
    const names = new Set(current.entities.map((e: any) => e.name))
    for (const c of data.circunscripciones) for (const p of c.partidos) expect(names.has(p), `${c.nombre}: ${p}`).toBe(true)
  })
})
