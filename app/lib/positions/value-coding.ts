/**
 * Codificación editorial de una posición aprobada (docs/scoring-methodology.md):
 *  - ±1/±2 con condiciones relevantes  → stance_status 'conditional' (incluida, con nota de condición)
 *  - ±1/±2 sin condiciones             → 'approved'
 *  - 0 solo si hay neutralidad EXPLÍCITA → 'explicit_neutral'
 *  - señales/fuentes contradictorias o no comparable → sin valor, excluida
 * Nunca se asigna 0 por ausencia de información.
 */
export type PositionValue = -2 | -1 | 0 | 1 | 2
export type ExclusionStatus = 'ambiguous' | 'conflicting_sources' | 'not_comparable'

export type ValueChoice =
  | { kind: 'value'; value: PositionValue; conditional?: boolean; conditions?: string | null }
  | { kind: 'exclude'; status: ExclusionStatus }

export interface PositionFields {
  value: number | null
  stance_status: 'approved' | 'explicit_neutral' | 'conditional' | ExclusionStatus
  conditions: string | null
}

const VALUES: PositionValue[] = [-2, -1, 0, 1, 2]
const EXCLUSIONS: ExclusionStatus[] = ['ambiguous', 'conflicting_sources', 'not_comparable']

export class ValueCodingError extends Error {}

export function toPositionFields(c: ValueChoice): PositionFields {
  if (c.kind === 'exclude') {
    if (!EXCLUSIONS.includes(c.status)) throw new ValueCodingError('Estado de exclusión no válido')
    return { value: null, stance_status: c.status, conditions: null }
  }
  if (!VALUES.includes(c.value)) throw new ValueCodingError('El valor debe ser -2, -1, 0, 1 o 2')
  if (c.value === 0) return { value: 0, stance_status: 'explicit_neutral', conditions: null }
  if (c.conditional) {
    const text = (c.conditions ?? '').trim()
    if (!text) throw new ValueCodingError('Indica la condición de la que depende la postura')
    return { value: c.value, stance_status: 'conditional', conditions: text.slice(0, 500) }
  }
  return { value: c.value, stance_status: 'approved', conditions: null }
}
