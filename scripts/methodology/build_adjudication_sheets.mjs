// Prepara, en LOCAL, el material de validación humana de las celdas prioritarias de la modalidad B: (1) hoja de codificación CIEGA (sin salidas de modelos, partido oculto,
// con manual y escala) y (2) hoja de adjudicación (con la referencia provisional y las respuestas de cada evaluador). No modifica nada del sistema.
import fs from 'node:fs'
import path from 'node:path'
import { loadRelease, OUT, ROOT, rng } from './lib.mjs'
const j = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_B_informe.json'), 'utf8')); const pk = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8'))
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const recs = fs.readFileSync(path.join(OUT, 'benchmark_S_B.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens))
const first = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!first[k] || r.repeat < first[k].repeat) first[k] = r }
const FULL = j.evaluadoresCompletos
const all = {}; for (const r of recs.filter((r) => FULL.includes(r.evaluator_label))) (all[r.cellId] ??= []).push(r.document_class)
const disc = [], unan = []; for (const [id, cl] of Object.entries(all)) { const sg = new Set(cl.filter((x) => x === 'supports' || x === 'opposes')); (new Set(cl).size > 1 || sg.size > 1 ? disc : unan).push(id) }
const rand = rng(29); const aud = unan.filter(() => rand() < 0.25)
const motivo = {}; const add = (id, m) => (motivo[id] = [...(motivo[id] ?? []), m])
j.prioridadAdjudicacion.forEach((p) => p.motivos.forEach((m) => add(p.cellId, m))); j.sinPosicion.filter((c) => c.posibleOmision).forEach((c) => add(c.cellId, 'celda sin posición registrada con posible posición según ≥2 evaluadores')); disc.forEach((id) => add(id, 'regla pre-registrada: discrepancia')); aud.forEach((id) => add(id, 'regla pre-registrada: auditoría aleatoria de unánimes (25 %, semilla 29)'))
const ids = Object.keys(motivo); const byId = Object.fromEntries(pk.S.map((c) => [c.cellId, c]))
const scale = '**Clases:** `supports` · `opposes` · `explicit_neutral` · `not_mentioned` (nada en los pasajes dados; NO es neutralidad ni oposición) · `ambiguous`.  **Intensidad:** supports +1/+2, opposes −1/−2, explicit_neutral 0, resto vacío. Criterios en `docs/guia-intensidad.md` y `docs/methodology/coding-manual-v0.md`.'
let blind = `# Hoja de codificación CIEGA (validación humana) — ${ids.length} celdas\n\nGenerada ${new Date().toISOString()}. No contiene salidas de modelos ni la referencia. Partido oculto. Registrar clase, intensidad, cita literal (con página) y justificación; no se ve la respuesta de nadie más.\n\n${scale}\n`
let adj = `# Hoja de adjudicación — ${ids.length} celdas\n\nLOCAL. Incluye la referencia provisional (codificación registrada) y las respuestas de cada evaluador. **Usar solo tras la codificación ciega humana.** La referencia y los modelos pueden estar equivocados; no se adjudica por mayoría.\n`
ids.forEach((id, n) => { const c = byId[id]; if (!c) return; const p = pm.get(id); const ref = p ? `${p.value ?? '—'} (${p.stanceStatus})` : 'sin posición registrada'
  blind += `\n---\n\n## Celda ${n + 1}\n**Pregunta:** ${c.item}\n\n**Contexto:** ${c.context}\n\n**Pasajes del programa del «Partido ${String.fromCharCode(65 + (n % 26))}»:**\n${c.passagesB.map((x, i) => `${i + 1}. (pág. ${x.page}) ${x.text}`).join('\n\n')}\n\n**Su codificación:** clase ______  intensidad ____  cita literal y página: ______________  justificación: ______________\n`
  const resp = [...new Set(recs.filter((r) => r.cellId === id).map((r) => r.evaluator_label))].map((L) => first[id + '|' + L]).filter(Boolean)
  adj += `\n---\n\n## Celda ${n + 1} — ${c.party}\n**Motivos:** ${motivo[id].join('; ')}\n\n**Pregunta:** ${c.item}\n\n**Referencia provisional:** ${ref}${p?.evidence?.[0] ? `  · cita registrada (pág. ${p.evidence[0].page}): «${String(p.evidence[0].text).slice(0, 220)}…»` : ''}\n\n**Evaluadores:**\n${resp.map((r) => `- ${r.evaluator_label}: ${r.document_class}${r.intensity !== null && r.intensity !== undefined ? ' ' + r.intensity : ''} — «${String(r.quote ?? '').slice(0, 140)}»`).join('\n')}\n\n**Adjudicación humana:** clase ______  intensidad ____  motivo: ______________\n` })
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/hoja_codificacion_ciega.md'), blind); fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/hoja_adjudicacion.md'), adj)
console.log(JSON.stringify({ celdas: ids.length, prioritarias: j.prioridadAdjudicacion.length, posiblesOmisiones: j.sinPosicion.filter((c) => c.posibleOmision).length, reglaPreRegistrada: disc.length + aud.length, solapamientoEntreCriterios: j.prioridadAdjudicacion.length + 3 + disc.length + aud.length - ids.length }))
