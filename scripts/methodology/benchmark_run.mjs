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
const pack = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack.json'), 'utf8'))
const panel = JSON.parse(fs.readFileSync(path.join(LOCAL, 'panel.json'), 'utf8')).models

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
const cells = (pack[set] ?? []).filter((c) => modality === 'B' || c.passagesA).map((c) => ({ ...c, passages: modality === 'A' ? c.passagesA : c.passagesB })).slice(0, +arg('limit', 1e9))
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
const outFile = path.join(OUT, `benchmark_${set}_${modality}_${new Date().toISOString().slice(0, 10)}.jsonl`)
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.cellId}|${r.evaluator_label}|${r.repeat}` }) : [])
const norm = (x) => String(x ?? '').toLowerCase().replace(/^@cf\//, '')
const tail = (x) => norm(x).split('/').pop().replace(/:free$|-free$/, '')
const flat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const verifyQuote = (q, c) => { if (!q) return null; const f = flat(q), all = flat(c.passages.map((p) => p.text).join(' ')); if (f && all.includes(f)) return 'exact'; const w = f.split(' ').filter((x) => x.length > 3); return w.length && w.filter((x) => all.includes(x)).length / w.length >= 0.8 ? 'fuzzy' : 'none' }
const VALID = { supports: [1, 2], opposes: [-2, -1], explicit_neutral: [0], not_mentioned: [null], ambiguous: [null] }

async function one(m, c, repeat) {
  const t0 = Date.now(); const rec = { run_id: runId, cellId: c.cellId, set, modality, evidence_scope: modality === 'A' ? 'reference_evidence_plus_distractors' : 'passages_retrieved', repeat, evaluator_label: m.label, evaluator_kind: 'ai', provider: m.group, model_family: m.vendor, model_requested: m.id, manual_version: MANUAL_VERSION, prompt_version: PROMPT_SHA.slice(0, 12), item_text_sha256: sha(c.item), blind: true, independent_of: [], stratum: c.stratum, party: c.party, language: c.language }
  try {
    const r = await fetch('http://127.0.0.1:20128/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: m.id, temperature: 0, max_tokens: m.maxTokens ?? 800, messages: [{ role: 'system', content: system(crypto.randomUUID()) }, { role: 'user', content: userMsg(c) }] }), signal: AbortSignal.timeout(m.timeoutMs ?? +arg('timeout', 45000)) })
    const j = await r.json().catch(() => null); const content = j?.choices?.[0]?.message?.content ?? ''
    rec.latency_ms = Date.now() - t0; rec.model_actual = j?.model ?? null; rec.usage = j?.usage ?? {}; rec.http_status = r.status
    rec.fallback_used = r.status === 200 ? !norm(j?.model).includes(tail(m.id)) : null
    if (r.status === 429) { rec.execution_status = 'rate_limited' } else if (r.status >= 400) { rec.execution_status = 'api_error'; rec.error_detail = scrub(JSON.stringify(j)).slice(0, 220) }
    else if (j?.choices?.[0]?.finish_reason === 'content_filter') rec.execution_status = 'refused'
    else {
      let p = null; try { p = JSON.parse(String(content).replace(/^\s*```(json)?|```\s*$/g, '').trim()) } catch {}
      const okShape = p && p.document_class in VALID && VALID[p.document_class].includes(p.intensity ?? null)
      if (!okShape) { rec.execution_status = 'invalid_output'; rec.error_detail = content ? 'JSON o valores no válidos' : 'respuesta vacía (¿solo razonamiento?)' }
      else { rec.execution_status = 'ok'; Object.assign(rec, { document_class: p.document_class, intensity: p.intensity ?? null, quote: p.quote ?? null, page: p.page ?? null, rationale: String(p.rationale ?? '').slice(0, 400), quote_verified: verifyQuote(p.quote, c) }) }
    }
  } catch (e) { rec.latency_ms = Date.now() - t0; rec.execution_status = /timeout|abort/i.test(e.name + e.message) ? 'timeout' : 'api_error'; rec.error_detail = scrub(e.message).slice(0, 160) }
  fs.appendFileSync(outFile, JSON.stringify(rec) + '\n'); return rec
}
// Paralelo entre proveedores, serie dentro de cada uno (respeta límites de tasa); resultados escritos al llegar.
const groups = {}; for (const m of models) (groups[m.group] ??= []).push(m)
await Promise.all(Object.values(groups).map(async (ms) => { for (const m of ms) for (const c of cells) for (let k = 1; k <= repeats; k++) if (!done.has(`${c.cellId}|${m.label}|${k}`)) await one(m, c, k) }))
console.log('Terminado. Resultados en', path.relative(ROOT, outFile))
