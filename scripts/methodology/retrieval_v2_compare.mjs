// Compara la recuperación B-1.0.0 (la usada en el piloto) con la B-2.0.0 (segmentación v2) sobre las celdas del piloto, SIN modelos de lenguaje. Referencia: las evidencias que el responsable
// verificó en el programa original al adjudicar (BD local) y la cita registrada en la referencia provisional. Mide si cada evidencia aparece, literalmente, en los 10 pasajes entregados.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { OUT, loadRelease } from './lib.mjs'
const flat = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-\s+/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()
const found = (needle, passages) => { const n = flat(needle); if (n.length < 15) return null; const head = n.split(' ').slice(0, 12).join(' '); return passages.some((p) => flat(p.text).includes(head)) }
const v1 = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8')).S; const V1 = Object.fromEntries(v1.map((c) => [c.cellId, c.passagesB]))
const V2 = JSON.parse(fs.readFileSync(path.join(OUT, 'v2', 'pack_v2_pilot.json'), 'utf8')).cells
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`SELECT c.ord, c.question_id||'|'||c.entity_id AS id, a.evidence FROM eval_cells c JOIN eval_campaigns k ON k.id = c.campaign_id AND k.kind = 'pilot'
  LEFT JOIN eval_adjudications a ON a.cell_id = c.id AND a.revision = (SELECT max(revision) FROM eval_adjudications y WHERE y.cell_id = c.id) ORDER BY c.ord`); await pool.end()
const adj = Object.fromEntries(rows.map((r) => [r.id, { ord: r.ord, ev: r.evidence ?? [] }]))
const pages = (ps) => [...new Set(ps.map((p) => p.page))].sort((a, b) => a - b)
const res = []
for (const id of Object.keys(V2)) {
  const reg = (pm.get(id)?.evidence ?? []).map((e) => e.text); const ev = (adj[id]?.ev ?? []).map((e) => e.text)
  const row = { ord: adj[id]?.ord ?? null, citaRegistrada: reg.length ? { v1: reg.some((t) => found(t, V1[id])), v2: reg.some((t) => found(t, V2[id])) } : null,
    evidenciasVerificadas: ev.length ? { n: ev.length, v1: ev.filter((t) => found(t, V1[id])).length, v2: ev.filter((t) => found(t, V2[id])).length } : null,
    pasajesAmpliadosEnTop10: V2[id].filter((p) => p.extended).length,
    pasajesIguales: V2[id].filter((p) => V1[id].some((q) => flat(q.text) === flat(p.text))).length,
    paginasSoloV1: pages(V1[id]).filter((p) => !pages(V2[id]).includes(p)), paginasSoloV2: pages(V2[id]).filter((p) => !pages(V1[id]).includes(p)) }
  res.push(row)
}
res.sort((a, b) => (a.ord ?? 99) - (b.ord ?? 99))
console.log('celda | cita registrada v1→v2 | evidencias verificadas (n) v1→v2 | ampliados en top10 | pasajes idénticos | págs solo v1 | págs solo v2')
for (const r of res) console.log(`${String(r.ord).padStart(2)} | ${r.citaRegistrada ? `${r.citaRegistrada.v1 ? 'sí' : 'NO'}→${r.citaRegistrada.v2 ? 'sí' : 'NO'}` : '—'} | ${r.evidenciasVerificadas ? `${r.evidenciasVerificadas.v1}→${r.evidenciasVerificadas.v2} de ${r.evidenciasVerificadas.n}` : '—'} | ${r.pasajesAmpliadosEnTop10} | ${r.pasajesIguales}/10 | ${r.paginasSoloV1.join(',') || '—'} | ${r.paginasSoloV2.join(',') || '—'}`)
const tot = (k) => res.reduce((s, r) => s + (r.evidenciasVerificadas?.[k] ?? 0), 0), n = res.reduce((s, r) => s + (r.evidenciasVerificadas?.n ?? 0), 0)
console.log(`\nEvidencias verificadas encontradas en el top-10: v1 ${tot('v1')}/${n}, v2 ${tot('v2')}/${n}. Celdas con algún pasaje ampliado en el top-10: ${res.filter((r) => r.pasajesAmpliadosEnTop10 > 0).length}/${res.length}`)
fs.writeFileSync(path.join(OUT, 'v2', 'comparacion_v1_v2.json'), JSON.stringify(res, null, 1))
