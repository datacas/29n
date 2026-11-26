// Fase 1 · Ejecutor del benchmark reducido de modelos codificadores. NO se lanza sin autorización expresa.
//   --dry-run                 construye los prompts y estima tokens; no llama a ningún modelo
//   --freeze                  congela la huella del prompt y del manual tras ajustar con D (no llama a modelos)
//   --set S|D|E               conjunto a evaluar (E exige --final y prompt congelado)
//   --confirm-authorized      obligatorio para llamar a modelos (confirmación explícita de la persona responsable)
// Ciego: el prompt solo lleva pregunta, contexto y pasajes; nunca salidas de Claude ni de otros modelos.
// Estados técnicos separados de la clase documental (ver docs/methodology/clases-documentales.md).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT, OUT } from './lib.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) : d }
const flag = (n) => process.argv.includes(`--${n}`)
const LOCAL = path.join(ROOT, 'docs/methodology/local')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const manual = fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.md'), 'utf8')
const MANUAL_VERSION = (manual.match(/Versión \*\*([^*]+)\*\*/) ?? [])[1] ?? 'desconocida'
const pack = JSON.parse(fs.readFileSync(path.join(OUT, String(arg('pack', 'benchmark_pack.json'))), 'utf8'))
const panel = JSON.parse(fs.readFileSync(path.join(LOCAL, 'panel.json'), 'utf8')).models


// Modalidad B: el paquete debe proceder de la configuración de recuperación CONGELADA (sin cambios dinámicos de K, modelos ni reordenador).
{ const modB = String(arg('modality', 'A')).toUpperCase() === 'B'
  if (modB) { const fz = path.join(ROOT, 'docs/methodology/local/retriever_frozen.json'); const f = fs.existsSync(fz) ? JSON.parse(fs.readFileSync(fz, 'utf8')) : null
    if (!f || pack.meta?.retriever_config_sha256 !== f.sha256) { console.error('Modalidad B: el paquete no corresponde a la configuración de recuperación congelada.'); process.exit(2) } } }
const cellsFilter = arg('cells', false) ? new Set(JSON.parse(fs.readFileSync(String(arg('cells')), 'utf8'))) : null
const system = (nonce) => `${manual}\n\n[ref: ${nonce}]`
const userMsg = (c) => `PREGUNTA: ${c.item}\nCONTEXTO: ${c.context}\nPARTIDO: ${c.party}\n\nPASAJES DEL PROGRAMA (idioma: ${c.language}):\n${c.passages.map((p, i) => `[${i + 1}] (pág. ${p.page}) ${p.text}`).join('\n\n') || '(sin pasajes)'}\n\nResponde solo con el objeto JSON del manual.`
const PROMPT_SHA = sha(system('X') + userMsg({ item: 'I', context: 'C', party: 'P', language: 'es', passages: [] }) + MANUAL_VERSION + sha(manual))

if (flag('freeze')) {
  fs.writeFileSync(path.join(LOCAL, 'prompt_frozen.json'), JSON.stringify({ promptSha: PROMPT_SHA, manualSha: sha(manual), manualVersion: MANUAL_VERSION, frozenAt: new Date().toISOString(), panel: panel.map((m) => m.id) }, null, 2))
  console.log('Prompt congelado:', PROMPT_SHA.slice(0, 12)); process.exit(0)
}
const set = arg('set', 'S')
const modality = String(arg('modality', 'B')).toUpperCase()  // A = evidencia de referencia + distractores; B = recuperación automática
if (!['A', 'B'].includes(modality)) { console.error('--modality debe ser A o B'); process.exit(2) }
const cells = (pack[set] ?? []).filter((c) => (modality === 'B' || c.passagesA) && (!cellsFilter || cellsFilter.has(c.cellId))).map((c) => ({ ...c, passages: modality === 'A' ? c.passagesA : c.passagesB })).slice(0, +arg('limit', 1e9))
const repeats = +arg('repeats', 2)
const models = panel.filter((m) => (flag('include-retry') ? true : !m.retry))
if (flag('dry-run')) {
  const c = cells[0]; const chars = (system('x') + userMsg(c)).length
  console.log(JSON.stringify({ set, modality, cells: cells.length, models: models.length, repeats, manualVersion: MANUAL_VERSION, promptSha: PROMPT_SHA.slice(0, 12), approxPromptChars: chars, llamadasTotales: cells.length * models.length * repeats, tokensEntradaAprox: Math.round((chars / 4) * cells.length * models.length * repeats), grupos: [...new Set(models.map((m) => m.group))] }, null, 1))
  console.log('\n--- Ejemplo de mensaje de usuario (celda 1) ---\n' + userMsg(c).slice(0, 700) + '…'); process.exit(0)
}
// ---- guardas ------------------------------------------------------------------------------------------------------
if (!flag('confirm-authorized')) { console.error('Falta --confirm-authorized: el benchmark no se lanza sin autorización expresa.'); process.exit(2) }
if (set === 'E') {
  if (!flag('final')) { console.error('El conjunto E exige --final.'); process.exit(2) }
  const fz = fs.existsSync(path.join(LOCAL, 'prompt_frozen.json')) && JSON.parse(fs.readFileSync(path.join(LOCAL, 'prompt_frozen.json'), 'utf8'))
  if (!fz || fz.promptSha !== PROMPT_SHA) { console.error('E exige el prompt congelado y sin cambios (--freeze tras ajustar con D).'); process.exit(2) }
}
const KEY = fs.readFileSync(process.env.OMNIROUTE_BENCH_KEY_FILE, 'utf8').trim()
const scrub = (s) => String(s).split(KEY).join('<clave>').replace(/\b\d{4,}\*{3,}\w+/g, '<enmascarado>')
const runId = crypto.randomUUID()
const outFile = path.join(OUT, `benchmark_${set}_${modality}.jsonl`) // nombre estable: la reanudación no depende de la fecha
const MAX_ATTEMPTS = +arg('max-attempts', 3)            // intentos totales por (celda, modelo, repetición), entre reanudaciones
const BREAKER = +arg('breaker', 6)                      // fallos técnicos seguidos que detienen un proveedor
const BUDGETS = { ...(JSON.parse(fs.readFileSync(path.join(LOCAL, 'panel.json'), 'utf8')).budgets ?? {}) }
if (arg('budget-tokens-per-group', false)) for (const g of Object.keys(BUDGETS)) BUDGETS[g] = +arg('budget-tokens-per-group')
// Reanudación: se lee el fichero de resultados. Se omite lo ya terminado (ok o resultado del modelo) y lo que agotó intentos;
// se reintenta solo lo técnico transitorio (timeout, rate_limited, api_error 5xx/sin respuesta). Nunca se duplica una llamada completada.
// Un fallback es una respuesta de OTRO modelo: se conserva (se excluye de las métricas) pero la celda se reintenta.
const RETRYABLE = (r) => r.fallback_used === true || r.cache_hit === true || ['timeout', 'rate_limited'].includes(r.execution_status) || (r.execution_status === 'api_error' && (!r.http_status || r.http_status >= 500))
const LEGACY_MAXTOKENS = { 'gemini-3.6-flash': 700 }   // valor anterior de los registros sin el campo max_tokens (ver config_history en panel.json)
const panelBy = Object.fromEntries(panel.map((m) => [m.label, m]))
const prior = new Map()
if (fs.existsSync(outFile)) for (const l of fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (r.halted) continue; const pm = panelBy[r.evaluator_label]; if (pm && (r.max_tokens ?? LEGACY_MAXTOKENS[r.evaluator_label] ?? pm.maxTokens) !== (pm.maxTokens ?? 800)) continue; const k = `${r.cellId}|${r.evaluator_label}|${r.repeat}`; const o = prior.get(k) ?? { attempts: 0, final: false }; o.attempts++; if (!RETRYABLE(r)) o.final = true; prior.set(k, o) }
const todo = (m, c, k) => { const o = prior.get(`${c.cellId}|${m.label}|${k}`); return !o || (!o.final && o.attempts < MAX_ATTEMPTS) }
const norm = (x) => String(x ?? '').toLowerCase().replace(/^@cf\//, '')
const tail = (x) => norm(x).split('/').pop().replace(/:free$|-free$/, '')
const flat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const verifyQuote = (q, c) => { if (!q) return null; const f = flat(q), all = flat(c.passages.map((p) => p.text).join(' ')); if (f && all.includes(f)) return 'exact'; const w = f.split(' ').filter((x) => x.length > 3); return w.length && w.filter((x) => all.includes(x)).length / w.length >= 0.8 ? 'fuzzy' : 'none' }
const VALID = { supports: [1, 2], opposes: [-2, -1], explicit_neutral: [0], not_mentioned: [null], ambiguous: [null] }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(m, c) {
  const r = await fetch('http://127.0.0.1:20128/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}`, 'x-omniroute-no-memory': '1' }, body: JSON.stringify({ model: m.id, temperature: 0, max_tokens: m.maxTokens ?? 800, messages: [{ role: 'system', content: system(crypto.randomUUID()) }, { role: 'user', content: userMsg(c) }] }), signal: AbortSignal.timeout(m.timeoutMs ?? +arg('timeout', 45000)) })
  return { r, j: await r.json().catch(() => null) }
}
async function one(m, c, repeat) {
  const t0 = Date.now(); const rec = { max_tokens: m.maxTokens ?? 800, run_id: runId, cellId: c.cellId, set, modality, evidence_scope: modality === 'A' ? 'reference_evidence_plus_distractors' : 'passages_retrieved', repeat, evaluator_label: m.label, evaluator_kind: 'ai', provider: m.group, model_family: m.vendor, model_requested: m.id, manual_version: MANUAL_VERSION, prompt_version: PROMPT_SHA.slice(0, 12), item_text_sha256: sha(c.item), blind: true, independent_of: [], stratum: c.stratum, party: c.party, language: c.language, attempts_this_run: 0 }
  try {
    let res
    for (let t = 0; t < 3; t++) {   // reintento interno solo ante 429, respetando retry-after (máx. 60 s)
      res = await call(m, c); rec.attempts_this_run++
      if (res.r.status !== 429) break
      const ra = +res.r.headers.get('retry-after') || 20; await sleep(Math.min(ra, 60) * 1000)
    }
    const { r, j } = res; const content = j?.choices?.[0]?.message?.content ?? ''
    rec.latency_ms = Date.now() - t0; rec.finish_reason = j?.choices?.[0]?.finish_reason ?? null; rec.model_actual = j?.model ?? null; rec.usage = j?.usage ?? {}; rec.http_status = r.status
    rec.rate_headers = Object.fromEntries([...r.headers].filter(([k]) => /ratelimit|retry-after/i.test(k)))
    const H = (k) => r.headers.get(k); rec.omniroute = { cache: H('x-omniroute-cache'), cache_hit: H('x-omniroute-cache-hit'), model: H('x-omniroute-model'), provider: H('x-omniroute-provider'), cost_usd: H('x-omniroute-response-cost'), decision: H('x-omniroute-decision'), request_id: H('x-omniroute-request-id') }
    rec.cache_hit = H('x-omniroute-cache-hit') === 'true'; rec.cost_nonzero = Number(H('x-omniroute-response-cost') ?? 0) > 0
    if (H('x-omniroute-model')) rec.model_actual = H('x-omniroute-model')
    rec.fallback_used = r.status === 200 ? !norm(j?.model).includes(tail(m.id)) : null
    if (r.status === 429) rec.execution_status = 'rate_limited'
    else if (r.status >= 400) { rec.execution_status = 'api_error'; rec.error_detail = scrub(JSON.stringify(j)).slice(0, 220) }
    else if (j?.choices?.[0]?.finish_reason === 'content_filter') rec.execution_status = 'refused'
    else {
      let p = null; try { p = JSON.parse(String(content).replace(/^\s*```(json)?|```\s*$/g, '').trim()) } catch {}
      const okShape = p && p.document_class in VALID && VALID[p.document_class].includes(p.intensity ?? null)
      if (!okShape) { rec.execution_status = 'invalid_output'; rec.error_detail = content ? 'JSON o valores no válidos' : 'respuesta vacía (¿solo razonamiento?)'; rec.raw_preview = scrub(content || JSON.stringify(j?.choices?.[0]?.message ?? {})).slice(0, 300) }
      else { rec.execution_status = 'ok'; Object.assign(rec, { document_class: p.document_class, intensity: p.intensity ?? null, quote: p.quote ?? null, page: p.page ?? null, rationale: String(p.rationale ?? '').slice(0, 400), quote_verified: verifyQuote(p.quote, c) }) }
    }
  } catch (e) { rec.latency_ms = Date.now() - t0; rec.execution_status = /timeout|abort/i.test(e.name + e.message) ? 'timeout' : 'api_error'; rec.error_detail = scrub(e.message).slice(0, 160) }
  fs.appendFileSync(outFile, JSON.stringify(rec) + '\n'); return rec
}
// Paralelo entre proveedores, serie dentro de cada uno (respeta límites de tasa). Resultados escritos al llegar.
// Protecciones por proveedor: interruptor tras BREAKER fallos técnicos seguidos y presupuesto de tokens (panel.json → budgets).
const only = arg('models', false) ? String(arg('models')).split(',') : null
const groups = {}; for (const m of models) if (!only || only.includes(m.label)) (groups[m.group] ??= []).push(m)
const summary = {}
await Promise.all(Object.entries(groups).map(async ([g, ms]) => {
  let used = 0, delay = 0; const sm = (summary[g] = { llamadas: 0, ok: 0, fallos: 0, omitidas: 0, parada: null, modelosParados: {} })
  outer: for (const m of ms) {
    let streak = 0   // el interruptor es POR MODELO: un modelo en enfriamiento no debe impedir evaluar a otro del mismo proveedor
    for (const c of cells) for (let k = 1; k <= repeats; k++) {
      if (!todo(m, c, k)) { sm.omitidas++; continue }
      if (BUDGETS[g] && used >= BUDGETS[g]) { sm.parada = `presupuesto de tokens agotado (${used}/${BUDGETS[g]})`; break outer }
      if (delay) await sleep(delay)
      const rec = await one(m, c, k); sm.llamadas++; used += rec.usage?.total_tokens ?? Math.round((system('x').length + userMsg(c).length) / 4)
      // Ritmo adaptativo por proveedor: ante un 429 o un fallback se espera más (hasta 60 s); tras éxitos limpios se acorta.
      delay = (rec.execution_status === 'rate_limited' || rec.fallback_used) ? Math.min(Math.max(delay * 2, 8000), 60000) : rec.execution_status === 'ok' ? Math.floor(delay * 0.7) : delay
      if (rec.cost_nonzero) { sm.parada = `coste distinto de cero detectado (${rec.omniroute?.cost_usd} USD): parada inmediata`; break outer }
      if (rec.execution_status === 'ok') { sm.ok++; streak = 0 } else { sm.fallos++; if (['api_error', 'timeout', 'rate_limited'].includes(rec.execution_status)) streak++; if (streak >= BREAKER) { sm.modelosParados[m.label] = `interruptor: ${BREAKER} fallos técnicos seguidos (${rec.execution_status})`; fs.appendFileSync(outFile, JSON.stringify({ halted: true, group: g, model: m.label, reason: sm.modelosParados[m.label], at: new Date().toISOString(), run_id: runId }) + '\n'); continue outer } }
      if ((sm.llamadas % 10) === 0) console.error(`[${g}] ${sm.llamadas} llamadas, ${sm.ok} ok, tokens≈${used}`)
    }
  }
  if (sm.parada) fs.appendFileSync(outFile, JSON.stringify({ halted: true, group: g, reason: sm.parada, at: new Date().toISOString(), run_id: runId }) + '\n')
}))
console.log('Terminado. Resultados en', path.relative(ROOT, outFile)); console.log(JSON.stringify(summary, null, 1))
