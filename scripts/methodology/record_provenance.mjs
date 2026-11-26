// Registra (solo añadir) la procedencia de las evaluaciones/adjudicaciones de un evaluador en una campaña. Úsalo cuando la PERSONA que evaluó lo declare.
//   node scripts/methodology/record_provenance.mjs --campaign <id> --provenance human_verified --statement "Evaluado personalmente por <quien> el <fecha>"  [--scope all|evaluation|adjudication]
import pg from 'pg'
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d }
const campaign = arg('campaign'), provenance = arg('provenance'), statement = arg('statement'), scope = arg('scope', 'all')
if (!campaign || !provenance || !statement) { console.error('Faltan --campaign, --provenance y --statement'); process.exit(1) }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement, evidence)
  SELECT e.id, $1, $2, $3, $4, jsonb_build_object('fuente', 'declaración de la persona que evaluó', 'verificado_independientemente', false) FROM eval_evaluators e WHERE e.label = 'Humano interno 1' RETURNING id, scope, provenance`, [campaign, scope, provenance, statement])
console.log(rows); await pool.end()
