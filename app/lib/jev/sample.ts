import { hasRealConditions } from './review.ts'
import type { PositionInput } from './types.ts'

export type Stratum = 'catalan' | 'contradictory' | 'conditioned' | 'ambiguous' | 'clear'

export const STRATA: Stratum[] = ['catalan', 'contradictory', 'conditioned', 'ambiguous', 'clear']

// Solo marcadores que NO existen en castellano (no vale "sobre", "ser", "han", "ampliar"...)
const CATALAN_MARKERS =
  /\b(els|dels|amb|però|també|aquest|aquesta|aquests|aquestes|són|això|així|molt|seva|seves|nostre|nostra|garantir|habitatge|ensenyament|llengua|catalunya|països|serveis|hem|està|estan|tot[ae]s)\b|l·l/gi

export function looksCatalan(text: string): boolean {
  return (text.match(CATALAN_MARKERS)?.length ?? 0) >= 2
}

/** Estrato principal de una posición (prioridad: catalán, contradictoria, condicionada, ambigua, clara). */
export function stratumOf(p: PositionInput): Stratum {
  const text = p.claims.map((c) => c.literalText).join(' ')
  const stances = p.claims.map((c) => c.claudeStance ?? 'unclear')
  const agrees = stances.some((x) => x === 'agrees' || x === 'conditional_agrees')
  const disagrees = stances.some((x) => x === 'disagrees')
  if (looksCatalan(text)) return 'catalan'
  if (agrees && disagrees) return 'contradictory'
  if (stances.every((x) => x === 'unclear')) return 'ambiguous'
  if (stances.some((x) => x === 'conditional' || x === 'conditional_agrees') || p.claims.some((c) => hasRealConditions(c.conditions))) return 'conditioned'
  return 'clear'
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface SampleOptions {
  size: number
  seed: number
  /** Cuota objetivo por estrato; lo que sobre se rellena desde el resto */
  quotas?: Partial<Record<Stratum, number>>
}

export const DEFAULT_QUOTAS: Record<Stratum, number> = {
  catalan: 6,
  contradictory: 6,
  conditioned: 8,
  ambiguous: 8,
  clear: 2
}

export interface SampledPosition {
  position: PositionInput
  stratum: Stratum
}

/**
 * Muestra estratificada y reproducible (semilla fija). Dentro de cada estrato reparte por
 * partido en turnos para que ningún partido domine la muestra.
 */
export function stratifiedSample(all: PositionInput[], opts: SampleOptions): SampledPosition[] {
  const rnd = mulberry32(opts.seed)
  const quotas = { ...DEFAULT_QUOTAS, ...opts.quotas }
  const byStratum = new Map<Stratum, PositionInput[]>()
  for (const s of STRATA) byStratum.set(s, [])
  for (const p of all) byStratum.get(stratumOf(p))!.push(p)

  const picked: SampledPosition[] = []
  const used = new Set<string>()

  const takeRoundRobin = (pool: PositionInput[], stratum: Stratum, n: number) => {
    const byParty = new Map<string, PositionInput[]>()
    for (const p of shuffle(pool, rnd)) {
      if (!byParty.has(p.party)) byParty.set(p.party, [])
      byParty.get(p.party)!.push(p)
    }
    const queues = shuffle([...byParty.values()], rnd)
    let taken = 0
    while (taken < n && queues.some((q) => q.length)) {
      for (const q of queues) {
        if (taken >= n) break
        const p = q.shift()
        if (!p || used.has(p.positionId)) continue
        used.add(p.positionId)
        picked.push({ position: p, stratum })
        taken++
      }
    }
  }

  for (const s of STRATA) takeRoundRobin(byStratum.get(s)!, s, quotas[s])

  // Relleno desde estratos con excedente hasta llegar al tamaño pedido
  if (picked.length < opts.size) {
    for (const s of STRATA) {
      if (picked.length >= opts.size) break
      const rest = byStratum.get(s)!.filter((p) => !used.has(p.positionId))
      takeRoundRobin(rest, s, opts.size - picked.length)
    }
  }
  return picked.slice(0, opts.size)
}
