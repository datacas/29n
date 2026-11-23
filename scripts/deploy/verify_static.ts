/**
 * Verifica, sin base de datos, que los ficheros estáticos de app/public/data son coherentes y no están manipulados:
 *   1) sha256(canonical(manifest)) coincide con la huella publicada.
 *   2) el contenido que usa la encuesta (preguntas, partidos, posiciones, dimensiones) es el del manifiesto.
 *   3) cada cita de los programas enlaza con un PDF que existe en app/public/programas.
 *
 *   node scripts/deploy/verify_static.ts
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROGRAMS } from '../../app/lib/programs.ts'

const canonical = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`
  : JSON.stringify(v)
const root = join(process.cwd(), 'app', 'public')
const dir = join(root, 'data', 'releases')
let bad = 0
const fail = (m: string) => { console.log('FALLO:', m); bad++ }

const surveys = JSON.parse(readFileSync(join(root, 'data', 'surveys.json'), 'utf8'))
if (!surveys.length) fail('surveys.json vacío')
for (const s of surveys) {
  const id = s.release_id
  const manifest = JSON.parse(readFileSync(join(dir, `${id}.manifest.json`), 'utf8'))
  const hashFile = JSON.parse(readFileSync(join(dir, `${id}.hash.json`), 'utf8'))
  const payload = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'))
  const h = createHash('sha256').update(canonical(manifest)).digest('hex')
  if (h !== hashFile.hash) fail(`${s.release_version}: la huella no coincide con el manifiesto`)
  for (const k of ['questions', 'entities', 'positions', 'dimensions'] as const) {
    if (canonical(payload[k]) !== canonical(manifest.content[k])) fail(`${s.release_version}: «${k}» difiere del manifiesto`)
  }
  const missing = PROGRAMS.filter((p) => !existsSync(join(root, 'programas', p.file)))
  if (missing.length) fail(`faltan PDF: ${missing.map((m) => m.file).join(', ')}`)
  const entities = new Set(payload.entities.map((e: any) => e.name))
  const noPdf = [...entities].filter((n) => !PROGRAMS.some((p) => p.name === n))
  if (noPdf.length) fail(`partidos sin programa descargable: ${noPdf.join(', ')}`)
  if (!bad) console.log(`OK ${s.release_version}: huella ${h.slice(0, 16)}… · ${payload.questions.length} preguntas · ${payload.entities.length} partidos · ${payload.positions.length} posiciones`)
}
if (!readdirSync(dir).length) fail('no hay ficheros de release')
process.exit(bad ? 1 : 0)
