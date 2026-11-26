import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/** Los manuales congelados no pueden cambiar: un cambio exige una versión nueva y actualizar `manual-hashes.json` de forma deliberada. */
const ROOT = path.resolve(__dirname, '../..')
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/methodology/manual-hashes.json'), 'utf8'))
describe('Manuales de codificación congelados', () => {
  for (const [version, m] of Object.entries<any>(reg.manuales)) {
    it(`v${version}: la huella coincide con la registrada`, () => {
      const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, m.archivo))).digest('hex')
      expect(sha).toBe(m.sha256)
    })
  }
  it('v0.2 declara su versión y que v0.1 no se recalcula', () => {
    const t = fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.2.md'), 'utf8')
    expect(t).toMatch(/Versión \*\*0\.2\*\*/); expect(t).toMatch(/no se recalculan/)
  })
  it('v0.1 conserva su versión (los benchmarks la leen por su número)', () => {
    expect(fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.md'), 'utf8')).toMatch(/Versión \*\*0\.1-benchmark\*\*/)
  })
})
