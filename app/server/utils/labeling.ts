import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const STANCES = ['supports', 'opposes', 'conditional', 'unclear', 'contradictory'] as const
export type LabelStance = (typeof STANCES)[number]

export function samplePath(): string {
  return process.env.SPIKE12_SAMPLE || join(process.cwd(), 'docs', 'spike12', 'benchmark_sample.json')
}

export function readSample(): any {
  const p = samplePath()
  if (!existsSync(p)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No existe benchmark_sample.json. Ejecuta: node scripts/spike12/sample.ts'
    })
  }
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** Escritura atómica: un fallo a medias no corrompe las etiquetas ya guardadas. */
export function writeSample(data: unknown): void {
  const p = samplePath()
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

export function isLabeled(item: any): boolean {
  return (STANCES as readonly string[]).includes(item?.human?.stance) && !!item?.human?.annotator
}
