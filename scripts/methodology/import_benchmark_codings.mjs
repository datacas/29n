// Importa a la BD LOCAL (`position_codings`, solo añadir) las codificaciones EFECTIVAS de IA de los benchmarks A y B (conjunto S), para que el panel de métricas lea de una sola fuente.
// Efectivas = ejecución correcta, sin *fallback*, y (CLI) con uso de tokens: los mismos filtros de los análisis. Los fallos técnicos permanecen en los JSONL locales.
// No llama a modelos; no toca positions, el banco ni el scoring. Idempotente: cada fila lleva `config.import_key` y no se duplica.
//   node scripts/methodology/import_benchmark_codings.mjs            # simulación
//   node scripts/methodology/import_benchmark_codings.mjs --apply
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'
import { OUT } from './lib.mjs'
const APPLY = process.argv.includes('--apply')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const uuidOf = (s) => { const h = sha(s); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}` }
const files = [['A', 'benchmark_S_A.jsonl'], ['B', 'benchmark_S_B.jsonl']]
const rows = []
for (const [modality, f] of files) {
  const fp = path.join(OUT, f); if (!fs.existsSync(fp)) continue
  for (const r of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean).map(JSON.parse)) {
    if (r.halted || r.execution_status !== 'ok' || r.fallback_used || (r.via === 'cli' && !r.usage?.total_tokens)) continue
    const [questionId, entityId] = r.cellId.split('|')
    const key = sha([r.run_id, r.cellId, r.evaluator_label, r.repeat, r.modality ?? modality].join('|'))
    rows.push({ key, runId: uuidOf('run:' + r.run_id), questionId, entityId, r, modality: r.modality ?? modality })
  }
}
console.log(`Candidatas: ${rows.length} (A: ${rows.filter((x) => x.modality === 'A').length}, B: ${rows.filter((x) => x.modality === 'B').length})`)
if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); process.exit(0) }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
try {
  await c.query('BEGIN')
  const have = new Set((await c.query(`SELECT config->>'import_key' AS k FROM position_codings WHERE config ? 'import_key'`)).rows.map((x) => x.k)); let n = 0
  for (const x of rows) {
    if (have.has(x.key)) continue; const r = x.r
    await c.query(
      `INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, provider, model_family, model_requested, model_actual, fallback_used, blind, independent_of,
         item_text_sha256, manual_version, prompt_version, config, execution_status, document_class, intensity, evidence, rationale, usage)
       VALUES ($1,$2,$3,'ai',$4,$5,$6,$7,$8,false,true,'{}',$9,$10,$11,$12,'ok',$13,$14,$15,$16,$17)`,
      [x.runId, x.entityId, x.questionId, r.evaluator_label, r.provider ?? null, r.model_family ?? null, r.model_requested ?? null, r.model_actual ?? null, r.item_text_sha256 ?? sha(r.cellId), r.manual_version ?? null, r.prompt_version ?? null,
        JSON.stringify({ import_key: x.key, modality: x.modality, set: r.set ?? 'S', repeat: r.repeat ?? 1, via: r.via ?? 'api', stratum: r.stratum ?? null, evidence_scope: r.evidence_scope ?? null, source_file: 'benchmark_S_' + x.modality + '.jsonl', imported: 'import_benchmark_codings.mjs' }),
        r.document_class, r.intensity ?? null, JSON.stringify(r.quote ? [{ page: r.page ?? null, text: r.quote }] : []), r.rationale ?? null, JSON.stringify(r.usage ?? {})])
    n++
  }
  await c.query('COMMIT'); console.log(`Importadas ${n} codificaciones (${rows.length - n} ya existían).`)
} catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release(); await pool.end() }
