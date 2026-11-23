/**
 * Exporta la(s) encuesta(s) PUBLICADAS a ficheros estáticos para servir la web sin base de datos:
 *   app/public/data/surveys.json                  lista de encuestas publicadas (lo que mostraba /api/surveys)
 *   app/data/surveys.json                         la misma lista, importada por la portada para generarla en el build
 *   app/public/data/releases/<id>.json            contenido que usa la encuesta (lo que mostraba /api/releases/<id>/data)
 *   app/public/data/releases/<id>.manifest.json   manifiesto completo y congelado de la versión
 *   app/public/data/releases/<id>.hash.json       huella SHA-256 del manifiesto (para que cualquiera lo verifique)
 *
 *   node scripts/deploy/export_static.ts            (usa DATABASE_URL o la base local en el puerto 5433)
 */
import pg from 'pg'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { buildReleasePayload } from '../../app/lib/release/content.ts'

export const canonical = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`
  : JSON.stringify(v)

const OUT = join(process.cwd(), 'app', 'public', 'data')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
try {
  const { rows } = await pool.query(
    `SELECT c.id, c.slug, c.title, c.description, c.category, c.created_at,
            sr.id AS release_id, sr.version AS release_version, sr.manifest_jsonb, sr.manifest_hash, sr.scoring_model_version,
            c.slug AS consultation_slug, c.title AS consultation_title, c.description AS consultation_description
       FROM consultations c JOIN survey_releases sr ON sr.consultation_id = c.id
      WHERE sr.status = 'published' ORDER BY c.created_at DESC`)
  if (!rows.length) throw new Error('No hay ninguna encuesta publicada: no se exporta nada.')
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'releases'), { recursive: true })

  const surveys = rows.map(({ id, slug, title, description, category, created_at, release_id, release_version }) => ({ id, slug, title, description, category, created_at, release_id, release_version }))
  writeFileSync(join(OUT, 'surveys.json'), JSON.stringify(surveys))
  // Copia dentro del código: la portada se genera en el build con esta lista (sin pedirla por red)
  mkdirSync(join(process.cwd(), 'app', 'data'), { recursive: true })
  writeFileSync(join(process.cwd(), 'app', 'data', 'surveys.json'), JSON.stringify(surveys, null, 2))

  for (const r of rows) {
    const recomputed = createHash('sha256').update(canonical(r.manifest_jsonb)).digest('hex')
    if (recomputed !== r.manifest_hash) throw new Error(`La huella de ${r.release_version} no coincide con su manifiesto: no se exporta.`)
    const payload = await buildReleasePayload(((s: string, p?: unknown[]) => pool.query(s, p)) as any, r.release_id, {
      manifest_jsonb: r.manifest_jsonb, scoring_model_version: r.scoring_model_version, version: r.release_version,
      consultation_slug: r.consultation_slug, consultation_title: r.consultation_title, consultation_description: r.consultation_description
    } as any)
    writeFileSync(join(OUT, 'releases', `${r.release_id}.json`), JSON.stringify(payload))
    writeFileSync(join(OUT, 'releases', `${r.release_id}.manifest.json`), JSON.stringify(r.manifest_jsonb))
    writeFileSync(join(OUT, 'releases', `${r.release_id}.hash.json`), JSON.stringify({
      version: r.release_version, releaseId: r.release_id, algorithm: 'sha256',
      canonicalization: 'JSON con claves ordenadas alfabéticamente y sin espacios (ver scripts/deploy/export_static.ts, función canonical)',
      hash: r.manifest_hash
    }, null, 2))
    console.log(`OK ${r.release_version} (${r.release_id}) · huella ${r.manifest_hash.slice(0, 16)}… · ${(JSON.stringify(payload).length / 1024).toFixed(0)} KB`)
  }
  console.log('Exportado en', OUT.replace(process.cwd() + '/', ''), '· ids publicados para NUXT_STATS_RELEASE_IDS:', rows.map((r) => r.release_id).join(','))
} finally {
  await pool.end()
}
