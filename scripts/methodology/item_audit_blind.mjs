// Segunda auditoría de ÍTEMS, independiente y ciega (protocolo: docs/methodology/fase1/protocolo-auditoria-ciega.md). Modelos de ≥3 familias distintas servidos por OmniRoute; cada uno trabaja solo,
// sin ver a los demás ni la primera auditoría; solo recibe el texto de la pregunta, su texto explicativo y la escala. Sin pistas léxicas (no se menciona «conjunciones» ni «doble contenido» como regla).
// Incluye controles positivos (la pregunta de sindicatos y patronal + ítems sintéticos con doble contenido conocido), controles negativos (ítems limpios) y un 10 % de repeticiones.
// Autorizado por la persona responsable (2026-11-26: «adelante con todo»), SOLO con modelos gratuitos: se detiene al primer coste distinto de cero. Reanudable. No toca la BD ni el banco.
//   node scripts/methodology/item_audit_blind.mjs --dry-run
//   OMNIROUTE_BENCH_KEY_FILE=~/.config/29n/omniroute.key node scripts/methodology/item_audit_blind.mjs --confirm-authorized [--models a,b] [--limit N]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadRelease, OUT, ROOT, rng } from './lib.mjs'
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) : d }
const flag = (n) => process.argv.includes(`--${n}`)
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const LOCAL = path.join(ROOT, 'docs/methodology/local')
const panel = JSON.parse(fs.readFileSync(path.join(LOCAL, 'panel.json'), 'utf8')).models
const DEFAULT = ['llama-4-scout', 'minimax-m3.1-flash', 'mistral-large-4', 'nemotron-3.5-lightning', 'qwen3.8-27b-groq']
const labels = String(arg('models', DEFAULT.join(','))).split(','); const models = labels.map((l) => panel.find((m) => m.label === l)).filter(Boolean)
const r = loadRelease('2.1.2')
const items = r.questions.map((q, i) => ({ id: q.questionId, n: i + 1, text: q.canonicalText, context: q.contextText ?? '', kind: 'item' }))
const known = items.find((x) => /sindicat/i.test(x.text) && /empresarial|patronal/i.test(x.text))
const CTRL_POS = [
  '¿Debe subirse el salario mínimo y eliminarse el impuesto de sucesiones?',
  '¿Debe ampliarse la red de ferrocarril de cercanías y prohibirse la circulación de coches de combustión en el centro de las ciudades?',
  '¿Deben aumentar las pensiones mínimas y reducirse la edad de jubilación para los trabajos penosos?',
  '¿Debe reforzarse la sanidad pública con más personal y permitirse que cada comunidad cobre un copago?',
  '¿Deben prohibirse los pisos turísticos y bajarse el IVA de los alquileres de temporada?',
  '¿Debe garantizarse una plaza de guardería pública a cada niño y obligarse a las empresas a ofrecer teletrabajo a las madres?'].map((text, i) => ({ id: `CTRL+${i + 1}`, text, context: '', kind: 'control_positivo' }))
const CTRL_NEG = [
  '¿Debe subirse el salario mínimo interprofesional?', '¿Debe ampliarse la red de ferrocarril de cercanías?', '¿Debe aumentarse la pensión mínima?', '¿Debe aumentarse el número de profesionales de la sanidad pública?',
  '¿Deben limitarse los pisos turísticos en las ciudades?', '¿Debe garantizarse una plaza de guardería pública a cada niño?'].map((text, i) => ({ id: `CTRL-${i + 1}`, text, context: '', kind: 'control_negativo' }))
const rr = rng(2911); const repeats = items.filter(() => rr() < 0.1).map((x) => ({ ...x, id: x.id, kind: 'repeticion', repeatOf: x.id }))
const all = [...items, ...CTRL_POS, ...CTRL_NEG, ...repeats]
const SYSTEM = 'Eres un metodólogo de encuestas. Revisas preguntas de un cuestionario de afinidad con programas electorales. Respondes únicamente con un objeto JSON válido, sin texto adicional ni marcas de código.'
const user = (x) => `PREGUNTA: ${x.text}\nCONTEXTO: ${x.context || '(sin texto explicativo)'}\nESCALA: la persona responde de −2 (totalmente en desacuerdo) a +2 (totalmente de acuerdo), o «No sé».\n\nTarea, razonando con contraejemplos:\n1. Enumera las proposiciones independientes que una persona tendría que aceptar a la vez para responder «de acuerdo».\n2. Busca un contraejemplo: una posición política coherente que ninguna respuesta de la escala pueda expresar fielmente. Si no la hay, null.\n3. ¿Está claro qué significa estar de acuerdo (dirección de la pregunta)?\n4. ¿Hay presuposiciones o un alcance ambiguo?\n5. Neutralidad: ¿qué posiciones políticas favorece responder «de acuerdo»? ¿Hay términos cargados?\n\nDevuelve exactamente este JSON:\n{"propositions":["..."],"n_propositions":0,"counterexample":null,"direction_clear":true,"presupposition":null,"scope_ambiguity":null,"agree_favors":"izquierda|derecha|ninguna|depende|no_claro","loaded_terms":[],"severity":0,"verdict":"ok|doble_contenido|objeto_compuesto|vago|presuposicion|sesgo"}\n(severity 0 = sin problema, 3 = grave)`
const PROMPT_SHA = sha(SYSTEM + user({ text: 'P', context: 'C' }))
if (flag('dry-run')) { console.log(JSON.stringify({ items: items.length, controlesPositivos: CTRL_POS.length + (known ? 1 : 0), controlesNegativos: CTRL_NEG.length, repeticiones: repeats.length, total: all.length, modelos: models.map((m) => m.label), llamadas: all.length * models.length, promptSha: PROMPT_SHA.slice(0, 12), controlConocido: known?.text }, null, 1)); console.log('\n' + user(items[0])); process.exit(0) }
if (!flag('confirm-authorized')) { console.error('Falta --confirm-authorized.'); process.exit(2) }
const KEY = fs.readFileSync(String(process.env.OMNIROUTE_BENCH_KEY_FILE).replace(/^~/, process.env.HOME), 'utf8').trim()
const scrub = (s) => String(s).split(KEY).join('<clave>'); const sleep = (ms) => new Promise((x) => setTimeout(x, ms))
const outFile = path.join(OUT, 'item_audit_blind.jsonl'); const runId = crypto.randomUUID()
const norm = (x) => String(x ?? '').toLowerCase().replace(/^@cf\//, ''); const tail = (x) => norm(x).split('/').pop().replace(/:free$|-free$/, '')
const done = new Set(); if (fs.existsSync(outFile)) for (const l of fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean)) { const o = JSON.parse(l); if (!o.halted && (o.execution_status === 'ok' || (o.attempts ?? 0) >= 3)) done.add(`${o.evaluator_label}|${o.itemKey}`) }
const attemptsOf = {}
async function call(m, x) {
  const res = await fetch('http://127.0.0.1:20128/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(+arg('timeout-ms', 150000)), headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}`, 'x-omniroute-no-memory': '1' },
    body: JSON.stringify({ model: m.id, temperature: 0, max_tokens: +arg('max-tokens', 0) || Math.max(m.maxTokens ?? 800, 1600), messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user(x) }] }) })
  return { r: res, j: await res.json().catch(() => null) }
}
async function one(m, x, key) {
  const t0 = Date.now(); const rec = { run_id: runId, itemKey: key, itemId: x.id, itemKind: x.kind, repeatOf: x.repeatOf ?? null, evaluator_label: m.label, provider: m.group, model_family: m.vendor, model_requested: m.id, prompt_sha: PROMPT_SHA.slice(0, 12), blind: true, attempts: (attemptsOf[`${m.label}|${key}`] = (attemptsOf[`${m.label}|${key}`] ?? 0) + 1) }
  try {
    let res; for (let t = 0; t < 3; t++) { res = await call(m, x); if (res.r.status !== 429) break; await sleep(Math.min(+res.r.headers.get('retry-after') || 20, 60) * 1000) }
    const { r: rs, j } = res; const content = j?.choices?.[0]?.message?.content ?? ''; const H = (k) => rs.headers.get(k)
    rec.latency_ms = Date.now() - t0; rec.http_status = rs.status; rec.model_actual = H('x-omniroute-model') ?? j?.model ?? null; rec.usage = j?.usage ?? {}; rec.cost_usd = H('x-omniroute-response-cost'); rec.cost_nonzero = Number(rec.cost_usd ?? 0) > 0
    rec.fallback_used = rs.status === 200 ? !norm(rec.model_actual).includes(tail(m.id)) : null
    if (rs.status === 429) rec.execution_status = 'rate_limited'
    else if (rs.status >= 400) { rec.execution_status = 'api_error'; rec.error_detail = scrub(JSON.stringify(j)).slice(0, 200) }
    else { let p = null; try { p = JSON.parse(String(content).replace(/^\s*```(json)?|```\s*$/g, '').trim()) } catch {}
      if (!p || !Array.isArray(p.propositions) || typeof p.severity !== 'number') { rec.execution_status = 'invalid_output'; rec.raw_preview = scrub(content || JSON.stringify(j?.choices?.[0]?.message ?? {})).slice(0, 300) }
      else { rec.execution_status = 'ok'; rec.out = { propositions: p.propositions.slice(0, 8).map((s) => String(s).slice(0, 240)), n_propositions: Number.isFinite(+p.n_propositions) ? +p.n_propositions : p.propositions.length, counterexample: p.counterexample ? String(p.counterexample).slice(0, 300) : null, direction_clear: p.direction_clear !== false, presupposition: p.presupposition ? String(p.presupposition).slice(0, 240) : null, scope_ambiguity: p.scope_ambiguity ? String(p.scope_ambiguity).slice(0, 240) : null, agree_favors: String(p.agree_favors ?? ''), loaded_terms: (p.loaded_terms ?? []).slice(0, 6).map(String), severity: Math.max(0, Math.min(3, Math.round(+p.severity))), verdict: String(p.verdict ?? '') } } }
  } catch (e) { rec.latency_ms = Date.now() - t0; rec.execution_status = /timeout|abort/i.test(e.name + e.message) ? 'timeout' : 'api_error'; rec.error_detail = scrub(e.message).slice(0, 160) }
  fs.appendFileSync(outFile, JSON.stringify(rec) + '\n'); return rec
}
const groups = {}; for (const m of models) (groups[m.group] ??= []).push(m)
const limit = +arg('limit', 1e9); const summary = {}
await Promise.all(Object.entries(groups).map(async ([g, ms]) => { const sm = (summary[g] = { llamadas: 0, ok: 0, fallos: 0, parada: null }); let delay = 0
  outer: for (const m of ms) { const order = (() => { const o = rng(parseInt(sha(m.label).slice(0, 8), 16)); return all.map((x, i) => [o(), x, i]).sort((a, b) => a[0] - b[0]) })(); let streak = 0, n = 0
    const [sh, shN] = String(arg('shard', '0/1')).split('/').map(Number); for (const [, x, i] of order) { if (n >= limit) break; if (i % shN !== sh) continue; const key = x.kind === 'repeticion' ? `${x.id}#rep` : x.id; if (done.has(`${m.label}|${key}`)) continue; n++
      if (delay) await sleep(delay); const rec = await one(m, x, key); sm.llamadas++
      delay = (rec.execution_status === 'rate_limited' || rec.fallback_used) ? Math.min(Math.max(delay * 2, 8000), 60000) : rec.execution_status === 'ok' ? Math.floor(delay * 0.7) : delay
      if (rec.cost_nonzero) { sm.parada = `coste distinto de cero (${rec.cost_usd} USD): parada inmediata`; break outer }
      if (rec.execution_status === 'ok' && !rec.fallback_used) { sm.ok++; streak = 0 } else { sm.fallos++; streak++; if (streak >= 8) { sm.parada = `interruptor: 8 fallos seguidos en ${m.label}`; break } }
      if (sm.llamadas % 20 === 0) console.error(`[${g}/${m.label}] ${sm.llamadas} llamadas, ${sm.ok} ok`) } } }))
console.log('Terminado.', JSON.stringify(summary, null, 1))
