// Fase 3 del diseño muestral (LOCAL, sin modelos): valida la validez TÉCNICA de las celdas elegidas con los paquetes de evidencia ya generados, aplica los reemplazos predefinidos solo por invalidez técnica
// (nunca por dificultad o resultado), calcula contexto adicional, y congela muestra y paquetes con huellas. No escribe en la BD.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadRelease, OUT, ROOT } from './lib.mjs'
import { loadProgram } from './retrieval.mjs'
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const d = JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'sample_draw.json'), 'utf8'))
const packRaw = fs.readFileSync(path.join(OUT, 'h150', 'evidence_pack.json'), 'utf8'); const pack = JSON.parse(packRaw)
const cellsMeta = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(OUT, 'h150', 'cells_h150.json'), 'utf8')).cells.map((c) => [c.cellId, c]))
const rel = loadRelease('2.1.2'); const pm = new Map(rel.positions.map((p) => [p.questionId + '|' + p.entityId, p]))
const { PROGRAMS } = await import(path.join(ROOT, 'app/lib/programs.ts')); const byName = Object.fromEntries(PROGRAMS.map((p) => [p.name, p])); const progCache = {}
const flat = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-\s+/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()
const found = (needle, passages) => { const n = flat(needle); if (n.length < 15) return null; const head = n.split(' ').slice(0, 12).join(' '); return passages.some((p) => flat(p.text).includes(head)) }
// Invalidez TÉCNICA: sin paquete, <3 pasajes con texto, o programa sin texto extraíble. NO es técnica: dificultad, discrepancias, ausencia de cita registrada.
const technical = (id) => { const ps = pack.cells[id]; if (!ps) return 'sin paquete de evidencia'; if (ps.filter((p) => String(p.text).trim().length > 20).length < 3) return 'menos de 3 pasajes con texto'; return null }
const invalid = []; const subs = []
const finalR = d.R.map((c) => { const why = technical(c.id); if (!why) return { ...c, replacesCell: null }
  invalid.push({ id: c.id, tier: c.tier, why }); if (!c.replacement) throw new Error('Celda R inválida sin reemplazo: ' + c.id); if (technical(c.replacement)) throw new Error('El reemplazo también es inválido: ' + c.replacement)
  const [qid, eid] = c.replacement.split('|'); subs.push({ replaced: c.id, by: c.replacement }); return { ...c, id: c.replacement, questionId: qid, entityId: eid, party: cellsMeta[c.replacement].party, replacesCell: c.id } })
const reserve = [...d.Treserve]; const finalT = []
for (const c of [...d.T1, ...d.T2]) { const why = technical(c.id); if (!why) { finalT.push({ ...c, replacesCell: null }); continue }
  invalid.push({ id: c.id, tier: c.tier, why }); const rep = reserve.shift(); if (!rep || technical(rep.id)) throw new Error('Sin reserva T válida para ' + c.id); subs.push({ replaced: c.id, by: rep.id }); finalT.push({ ...rep, tier: c.tier, replacesCell: c.id }) }
const planned = [...finalR, ...finalT]
const extraContext = (party, passages, cap = 30) => { const prog = (progCache[party] ??= loadProgram(byName[party])); const pg = new Set(passages.map((p) => p.page).filter(Number.isInteger)); const want = new Set(); for (const p of pg) { want.add(p - 1); want.add(p); want.add(p + 1) }
  const shown = passages.map((p) => p.text); const o = []; for (const para of prog.paras) { if (!want.has(para.page)) continue; if (shown.some((t) => t.includes(para.text) || para.text.includes(t))) continue; o.push({ page: para.page, text: para.text }); if (o.length >= cap) break } return o }
const cells = planned.map((c) => { const m = cellsMeta[c.id]; const passages = pack.cells[c.id].map((p) => ({ page: p.page ?? null, text: p.text })); const ref = pm.get(c.id)
  return { id: c.id, questionId: c.id.split('|')[0], entityId: c.id.split('|')[1], party: m.party, language: m.language, sample: c.sample, tier: c.tier, stratum: c.stratum, stratumSize: c.stratumSize ?? null, stratumSampled: c.stratumSampled ?? null, pi: c.pi ?? null, weight: c.weight ?? null, seed: c.seed ?? null, replacesCell: c.replacesCell, repeat: !!c.repeat,
    snapshot: { item: m.item, context: m.context, language: m.language, passages }, extra: extraContext(m.party, passages),
    // SOLO LOCAL (no entra en la campaña): referencia registrada y si su cita está en lo recuperado
    registrada: ref ? { value: ref.value, stanceStatus: ref.stanceStatus, citaEnRecuperado: (ref.evidence ?? []).length ? (ref.evidence ?? []).some((e) => found(e.text, passages)) : null } : null } })
// orden de presentación: el del sorteo (semilla fija), aplicado a la lista final (los reemplazos heredan el lugar de la celda sustituida)
const place = new Map(d.ordenPresentacion.map((id, i) => [id, i])); const posOf = (c) => place.get(c.replacesCell ?? c.id) ?? 1e9
cells.sort((a, b) => posOf(a) - posOf(b) || a.id.localeCompare(b.id)); cells.forEach((c, i) => (c.ord = i + 1))
const designSha = sha(JSON.stringify({ base: d.designSha256, final: cells.map((c) => [c.id, c.tier, c.replacesCell]), repeat: cells.filter((c) => c.repeat).map((c) => c.id).sort() }))
const final = { generado: new Date().toISOString(), designSha256: designSha, drawSha256: d.designSha256, evidencePackSha256: sha(packRaw), retriever: { config: pack.config, config_sha256: pack.config_sha256, k: pack.k }, semillas: d.semillas, marco: d.marco, invalidasTecnicas: invalid, sustituciones: subs, cells }
fs.writeFileSync(path.join(OUT, 'h150', 'sample_final.json'), JSON.stringify(final))
fs.writeFileSync(path.join(OUT, 'h150', 'FROZEN.json'), JSON.stringify({ congelado: final.generado, designSha256: designSha, evidencePackSha256: final.evidencePackSha256, retriever: final.retriever, nota: 'No modificar: muestra y paquetes de evidencia congelados para la campaña.' }, null, 1))
const cnt = (a, k) => a.reduce((m, x) => ((m[x[k]] = (m[x[k]] ?? 0) + 1), m), {})
console.log(JSON.stringify({ celdas: cells.length, porMuestra: cnt(cells, 'sample'), porTier: cnt(cells, 'tier'), invalidasTecnicas: invalid.length, sustituciones: subs.length, repeticion: cells.filter((c) => c.repeat).length, designSha: designSha.slice(0, 12), packSha: final.evidencePackSha256.slice(0, 12) }))
const R = cells.filter((c) => c.sample === 'R'); const T = cells.filter((c) => c.sample === 'T')
const rc = (arr) => { const withReg = arr.filter((c) => c.registrada?.citaEnRecuperado != null); return { conCitaRegistrada: withReg.length, citaNoRecuperada: withReg.filter((c) => !c.registrada.citaEnRecuperado).length } }
console.log('comprobación de la cita registrada en lo recuperado — R:', JSON.stringify(rc(R)), '| T:', JSON.stringify(rc(T)))
