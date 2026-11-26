// Crea en la BD LOCAL la campaña humana de ~150 celdas con el manual v0.2 congelado: celdas, instantáneas de evidencia versionadas, asignación a «Humano interno 1», y el diseño muestral (inmutable, no visible al evaluador).
// Requiere haber ejecutado draw_sample_150, human150_export/build y finalize_sample_150 (muestra y paquetes congelados en out/h150/FROZEN.json). No llama a modelos; no toca positions.
//   node scripts/methodology/create_campaign_150.mjs            # simulación
//   node scripts/methodology/create_campaign_150.mjs --apply
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'
import { OUT, ROOT } from './lib.mjs'
const APPLY = process.argv.includes('--apply'); const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const final = JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'sample_final.json'), 'utf8')); const frozen = JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'FROZEN.json'), 'utf8'))
if (frozen.designSha256 !== final.designSha256 || frozen.evidencePackSha256 !== sha(fs.readFileSync(path.join(OUT, 'h150', 'evidence_pack.json'), 'utf8'))) { console.error('La muestra o los paquetes de evidencia han cambiado desde que se congelaron: se aborta.'); process.exit(2) }
const manualRaw = fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.2.md'), 'utf8'); const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/methodology/manual-hashes.json'), 'utf8')).manuales['0.2']
if (sha(manualRaw) !== reg.sha256) { console.error('El manual v0.2 no coincide con su huella congelada: se aborta.'); process.exit(2) }
const manual = manualRaw.replace(/## Salida[\s\S]*?(?=## Importante)/, '')
const NAME = 'Campaña humana v0.2 — muestra de desarrollo (150)'
console.log(`Campaña «${NAME}»: ${final.cells.length} celdas (R ${final.cells.filter((c) => c.sample === 'R').length}, T ${final.cells.filter((c) => c.sample === 'T').length}); diseño ${final.designSha256.slice(0, 12)}, paquetes ${final.evidencePackSha256.slice(0, 12)}, manual v0.2 ${reg.sha256.slice(0, 12)}.`)
if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); process.exit(0) }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
try {
  await c.query('BEGIN')
  if ((await c.query('SELECT 1 FROM eval_campaigns WHERE name = $1', [NAME])).rowCount) throw new Error('La campaña ya existe')
  const { rows: [ev] } = await c.query(`SELECT id FROM eval_evaluators WHERE label = 'Humano interno 1'`)
  const { rows: [camp] } = await c.query(
    `INSERT INTO eval_campaigns (name, kind, status, manual_version, manual_text, selection_method, selection_bias_note) VALUES ($1,'main','open','0.2',$2,$3,$4) RETURNING id`,
    [NAME, manual,
      `Muestra de las 56 preguntas de DESARROLLO (E sellado): 105 celdas REPRESENTATIVAS (aleatoria estratificada sistemática con pesos de diseño) + 41 DIRIGIDAS (20 candidatas de omisión por regla preinscrita + 21 restantes de S con codificaciones de IA), en orden aleatorio; el evaluador no sabe cuáles son de cada tipo. Diseño ${final.designSha256}; paquetes de evidencia ${final.evidencePackSha256} (recuperador ${final.retriever.config} ${final.retriever.config_sha256.slice(0, 12)}); manual v0.2 ${reg.sha256.slice(0, 12)}. Reemplazos solo por invalidez técnica (${final.sustituciones.length} aplicados).`,
      'Un único evaluador humano interno (sin concordancia humano–humano); referencia provisional (se mide concordancia, no exactitud); marco limitado a las preguntas de desarrollo (no generaliza a E ni a todo el banco); R se analiza con pesos de diseño y T aparte, nunca mezcladas; ceguera parcial.'])
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const x of final.cells) {
    const { rows: [cell] } = await c.query(`INSERT INTO eval_cells (campaign_id, ord, question_id, entity_id, blind_label, party_name, extra_context) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [camp.id, x.ord, x.questionId, x.entityId, `Partido ${labels[(x.ord * 7 + 3) % 26]}${x.ord}`, x.party, JSON.stringify(x.extra)])
    await c.query('INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ($1,1,$2,$3,$4)',
      [cell.id, JSON.stringify(x.snapshot), sha(JSON.stringify(x.snapshot)), `paquete de evidencia congelado (recuperador ${final.retriever.config}; paquetes ${final.evidencePackSha256.slice(0, 12)})`])
    await c.query('INSERT INTO eval_assignments (cell_id, evaluator_id) VALUES ($1,$2)', [cell.id, ev.id])
    await c.query(`INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, stratum_size, stratum_sampled, inclusion_prob, weight, replaces_cell, repeat_selected, seed, design_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [cell.id, x.sample, x.tier, x.stratum, x.stratumSize, x.stratumSampled, x.pi, x.weight, x.replacesCell, x.repeat, x.seed, final.designSha256])
  }
  await c.query('INSERT INTO eval_audit (evaluator_id, action, campaign_id, detail) VALUES ($1,$2,$3,$4)', [ev.id, 'campaign_created', camp.id, JSON.stringify({ cells: final.cells.length, designSha256: final.designSha256, evidencePackSha256: final.evidencePackSha256 })])
  await c.query('COMMIT'); console.log(`Campaña creada: ${camp.id}`)
} catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
