/**
 * Traducción al castellano de las citas de programas en otros idiomas (catalán, gallego...).
 *
 *   node scripts/spike12/translations.ts export   → docs/spike12/translate_todo.json  ({ "<posición>#<n>": "texto original" })
 *   node scripts/spike12/translations.ts import   → lee docs/spike12/translate_done.json ({ "<posición>#<n>": "traducción" })
 *                                                    y la guarda en evidence_jsonb[n].translation_es
 *
 * La cita ORIGINAL (literal_text) no se toca: la traducción se guarda aparte y se muestra como traducción.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dbPool, OUT_DIR, PARTY_LIST } from './common.ts'

const pool = dbPool()
try {
  const langs = PARTY_LIST.filter((p) => p.language !== 'es').map((p) => p.name)
  if (process.argv[2] === 'export') {
    const { rows } = await pool.query(
      `SELECT p.id, p.evidence_jsonb FROM positions p JOIN entities e ON e.id = p.entity_id
        WHERE e.name = ANY($1) AND jsonb_array_length(coalesce(p.evidence_jsonb,'[]')) > 0
          AND p.review_status IN ('approved','needs_review') ORDER BY e.name, p.id`, [langs])
    const todo: Record<string, string> = {}
    for (const r of rows) (r.evidence_jsonb as any[]).forEach((c, i) => { if (!c.translation_es && c.literal_text) todo[`${r.id}#${i}`] = c.literal_text })
    writeFileSync(join(OUT_DIR, 'translate_todo.json'), JSON.stringify(todo, null, 1))
    console.log(`${Object.keys(todo).length} citas por traducir (${langs.join(', ')})`)
  } else if (process.argv[2] === 'import') {
    const done = JSON.parse(readFileSync(join(OUT_DIR, 'translate_done.json'), 'utf8')) as Record<string, string>
    const byPos = new Map<string, Record<number, string>>()
    for (const [k, v] of Object.entries(done)) {
      const [id, idx] = k.split('#')
      if (!byPos.has(id)) byPos.set(id, {})
      byPos.get(id)![Number(idx)] = v
    }
    let n = 0
    for (const [id, tr] of byPos) {
      const { rows } = await pool.query(`SELECT evidence_jsonb FROM positions WHERE id = $1`, [id])
      if (!rows.length) continue
      const ev = rows[0].evidence_jsonb as any[]
      for (const [i, t] of Object.entries(tr)) if (ev[Number(i)]) { ev[Number(i)].translation_es = t; n++ }
      await pool.query(`UPDATE positions SET evidence_jsonb = $2::jsonb WHERE id = $1`, [id, JSON.stringify(ev)])
    }
    console.log(`${n} traducciones guardadas`)
  } else {
    console.error('Uso: translations.ts export|import'); process.exit(1)
  }
} finally {
  await pool.end()
}
