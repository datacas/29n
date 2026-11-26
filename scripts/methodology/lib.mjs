// Utilidades comunes de la fase 0 (solo lectura). No escribe en BD ni en app/public/data.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
export const OUT = path.join(ROOT, 'docs/methodology/local/out')   // local, fuera de git (info/exclude)

export function loadRelease(version = '2.1.2') {
  const dir = path.join(ROOT, 'app/public/data/releases')
  const surveys = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/public/data/surveys.json'), 'utf8'))
  const s = surveys.find((x) => x.release_version === version)
  if (!s) throw new Error(`Release ${version} no está en surveys.json`)
  const file = path.join(dir, `${s.release_id}.json`)
  const raw = fs.readFileSync(file)
  const r = JSON.parse(raw)
  r._sha256 = crypto.createHash('sha256').update(raw).digest('hex')
  r._file = path.relative(ROOT, file)
  const names = Object.fromEntries(r.entities.map((e) => [e.entityId, e.name]))
  r.partyName = (id) => names[id] ?? id
  return r
}

export const EVALUABLE = new Set(['approved', 'explicit_neutral', 'conditional'])
export const usable = (p) => EVALUABLE.has(p.stanceStatus) && p.value !== null && p.value !== undefined

// PRNG reproducible (mulberry32)
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function write(name, content) {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n')
}
export const pct = (x, d = 0) => (100 * x).toFixed(d) + ' %'
