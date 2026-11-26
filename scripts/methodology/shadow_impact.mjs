// Informe de IMPACTO EN SOMBRA (LOCAL, solo lectura): qué le pasaría al banco de posiciones del release 2.1.2 si se aplicaran las adjudicaciones vigentes (clase, intensidad y propuesta sobre el banco).
// NO modifica positions, el banco, el scoring ni el release: aplica los cambios SOLO en memoria. No llama a modelos. Separa las adjudicaciones por procedencia (human_verified frente al resto).
//   node scripts/methodology/shadow_impact.mjs
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { loadRelease, ROOT, usable } from './lib.mjs'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' })
const { rows } = await pool.query(`
  SELECT c.question_id||'|'||c.entity_id AS id, c.entity_id, k.name AS campaign, c.ord, a.revision, a.document_class AS cls, a.intensity AS int, a.proposed_action AS action, a.causes,
         coalesce((SELECT p.provenance FROM eval_provenance p WHERE p.evaluator_id = a.adjudicator_id AND p.campaign_id = k.id AND p.scope IN ('adjudication','all') ORDER BY (p.scope = 'adjudication') DESC, p.recorded_at DESC LIMIT 1), 'unverified') AS provenance
    FROM eval_adjudications a JOIN eval_cells c ON c.id = a.cell_id JOIN eval_campaigns k ON k.id = c.campaign_id
   WHERE a.revision = (SELECT max(revision) FROM eval_adjudications y WHERE y.cell_id = a.cell_id AND y.adjudicator_id = a.adjudicator_id)`); await pool.end()
const rel = loadRelease('2.1.2'); const names = Object.fromEntries(rel.entities.map((e) => [e.entityId, e.name]))
const base = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, { value: p.value, status: p.stanceStatus }]))
const shape = (m) => { let pos = 0, neg = 0, p2 = 0, p1 = 0, n1 = 0, n2 = 0, other = 0; for (const v of m.values()) { if (v.value == null || !usable({ value: v.value, stanceStatus: v.status })) { other++; continue } if (v.value > 0) { pos++; v.value === 2 ? p2++ : p1++ } else if (v.value < 0) { neg++; v.value === -2 ? n2++ : n1++ } else other++ } const n = pos + neg; return { posiciones: m.size, positivas: pos, negativas: neg, 'positivas %': n ? +(100 * pos / n).toFixed(1) : null, '+2': p2, '+1': p1, '-1': n1, '-2': n2, otras: other } }
const sections = {}
for (const prov of [...new Set(rows.map((r) => r.provenance))]) {
  const shadow = new Map(base); const log = { add: [], remove: [], correct: [], confirm: 0, none: 0, inconsistentes: [] }
  for (const r of rows.filter((x) => x.provenance === prov)) {
    const had = base.has(r.id); const val = r.cls === 'supports' || r.cls === 'opposes' ? r.int : r.cls === 'explicit_neutral' ? 0 : null
    switch (r.action) {
      case 'add_position': if (had) log.inconsistentes.push(`${r.campaign.slice(0, 12)} celda ${r.ord}: add_position pero ya hay posición`); else if (val == null) log.inconsistentes.push(`celda ${r.ord}: add_position sin valor`); else { shadow.set(r.id, { value: val, status: 'approved' }); log.add.push({ party: names[r.entity_id], value: val }) } break
      case 'remove_registered': if (!had) log.inconsistentes.push(`celda ${r.ord}: remove_registered sin posición`); else { shadow.delete(r.id); log.remove.push({ party: names[r.entity_id], was: base.get(r.id).value }) } break
      case 'correct_registered': if (!had || val == null) log.inconsistentes.push(`celda ${r.ord}: correct_registered inválida`); else { log.correct.push({ party: names[r.entity_id], from: base.get(r.id).value, to: val }); shadow.set(r.id, { value: val, status: 'approved' }) } break
      case 'confirm_registered': log.confirm++; break
      default: log.none++
    }
  }
  const party = {}; for (const [k, a] of Object.entries({ add: log.add, remove: log.remove, correct: log.correct })) for (const x of a) { party[x.party] ??= { add: 0, remove: 0, correct: 0 }; party[x.party][k]++ }
  sections[prov] = { adjudicadas: rows.filter((x) => x.provenance === prov).length, antes: shape(base), despuesEnSombra: shape(shadow), cambios: { añadir: log.add.length, retirar: log.remove.length, corregir: log.correct.length, confirmar: log.confirm, sinAccion: log.none }, porPartido: party, inconsistentes: log.inconsistentes }
}
console.log(JSON.stringify(sections, null, 1))
let md = `# Impacto en sombra de las adjudicaciones (LOCAL, solo lectura)\n\nGenerado ${new Date().toISOString()}. Aplica en MEMORIA las propuestas informativas de las adjudicaciones vigentes al release 2.1.2; **no modifica nada**. Separado por procedencia: solo \`human_verified\` puede sustentar un cambio real del banco; el resto son decisiones de un agente (piloto) o sin verificar.\n\n`
for (const [prov, s] of Object.entries(sections)) md += `## Procedencia: ${prov} (${s.adjudicadas} adjudicaciones)\n- Cambios: ${JSON.stringify(s.cambios)}\n- Antes: ${JSON.stringify(s.antes)}\n- Después (en sombra): ${JSON.stringify(s.despuesEnSombra)}\n- Por partido: ${JSON.stringify(s.porPartido)}\n${s.inconsistentes.length ? `- **Inconsistencias**: ${s.inconsistentes.join('; ')}\n` : ''}\n`
md += `## Límites\n- Las adjudicaciones cubren celdas elegidas (piloto dirigido; 150 con muestra representativa): **no** se extrapolan a todo el banco sin los pesos de diseño.\n- No evalúa el efecto sobre el scoring ni sobre el ranking de los usuarios: eso requiere recalcular con el modelo de scoring público (siguiente paso).\n`
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/INFORME_impacto_sombra.md'), md)
