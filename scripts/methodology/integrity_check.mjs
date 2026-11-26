// Comprobación de INTEGRIDAD temporal de las evaluaciones (LOCAL, solo lectura). Las fuentes inmutables (eval_audit y position_codings.created_at, de solo añadir y escritas en la misma transacción
// que la finalización) deben coincidir con eval_drafts.finalized_at/updated_at. Si no coinciden, o hay marcas de tiempo en el futuro, alguien modificó los borradores por SQL directo saltándose la interfaz y su guarda.
// También informa del RITMO real de finalización (según las fuentes inmutables), para valorar si es compatible con una evaluación personal.
//   node scripts/methodology/integrity_check.mjs      (código de salida 1 si hay incoherencias)
import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`
  SELECT k.name, count(*)::int AS n,
         max(abs(extract(epoch FROM d.finalized_at - pc.created_at)))::int AS desfase_max_s,
         min(pc.created_at) AS primera, max(pc.created_at) AS ultima,
         count(*) FILTER (WHERE d.finalized_at > now() OR d.updated_at > now())::int AS en_futuro,
         count(*) FILTER (WHERE a.at IS NULL)::int AS sin_auditoria
    FROM eval_drafts d JOIN eval_cells c ON c.id = d.cell_id JOIN eval_campaigns k ON k.id = c.campaign_id
    JOIN position_codings pc ON pc.id = d.coding_id
    LEFT JOIN eval_audit a ON a.cell_id = d.cell_id AND a.action = 'finalize'
   WHERE d.finalized_at IS NOT NULL GROUP BY k.name ORDER BY min(pc.created_at)`)
const { rows: pace } = await pool.query(`SELECT k.name, percentile_cont(0.5) WITHIN GROUP (ORDER BY gap)::numeric(10,1) AS mediana_s FROM (
    SELECT c.campaign_id, extract(epoch FROM pc.created_at - lag(pc.created_at) OVER (PARTITION BY c.campaign_id ORDER BY pc.created_at)) AS gap FROM position_codings pc JOIN eval_cells c ON c.campaign_id = pc.campaign_id AND c.question_id = pc.question_id AND c.entity_id = pc.entity_id WHERE pc.evaluator_kind = 'human') g
    JOIN eval_campaigns k ON k.id = g.campaign_id WHERE gap IS NOT NULL GROUP BY k.name`); await pool.end()
const m = Object.fromEntries(pace.map((p) => [p.name, p.mediana_s])); let bad = 0
for (const r of rows) {
  const dur = Math.round((new Date(r.ultima) - new Date(r.primera)) / 1000); const flags = []
  if (r.desfase_max_s > 5) flags.push(`finalized_at difiere de la marca inmutable hasta ${r.desfase_max_s} s`); if (r.en_futuro) flags.push(`${r.en_futuro} borradores con marcas de tiempo en el FUTURO`); if (r.sin_auditoria) flags.push(`${r.sin_auditoria} sin auditoría`)
  if (flags.length) bad++
  console.log(`${flags.length ? 'INCOHERENTE' : 'ok         '} · ${r.name}: ${r.n} finalizadas · según las marcas inmutables: ${dur} s en total (mediana ${m[r.name] ?? '—'} s entre finalizaciones)${flags.length ? ' · ' + flags.join(' · ') : ''}`)
}
process.exitCode = bad ? 1 : 0
