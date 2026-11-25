// Fase 1 · Evaluadores adicionales por CLI (Codex y DeepSeek vía OpenCode) con el MISMO manual, pasajes y formato que benchmark_run.mjs.
// Se ejecutan en un directorio vacío y aislado (sin acceso al repositorio ni a resultados previos; Codex en sandbox de solo lectura, sin config de
// usuario). Diferencia respecto a la API: las CLI no admiten mensaje de sistema, así que manual y consulta van en un único mensaje de usuario.
// Escribe en el mismo fichero de resultados que benchmark_run.mjs para que benchmark_analyze.mjs los incluya.
// Guardas: sin --confirm-authorized no llama; presupuesto de tokens y parada si el coste declarado no es cero.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { ROOT, OUT } from './lib.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) : d }
const flag = (n) => process.argv.includes(`--${n}`)
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const manual = fs.readFileSync(path.join(ROOT, 'docs/methodology/coding-manual-v0.md'), 'utf8')
const MANUAL_VERSION = (manual.match(/Versión \*\*([^*]+)\*\*/) ?? [])[1] ?? 'desconocida'
const pack = JSON.parse(fs.readFileSync(path.join(OUT, String(arg('pack', 'benchmark_pack.json'))), 'utf8'))

// Modalidad B: el paquete debe proceder de la configuración de recuperación CONGELADA (sin cambios dinámicos de K, modelos ni reordenador).
{ const modB = String(arg('modality', 'A')).toUpperCase() === 'B'
  if (modB) { const fz = path.join(ROOT, 'docs/methodology/local/retriever_frozen.json'); const f = fs.existsSync(fz) ? JSON.parse(fs.readFileSync(fz, 'utf8')) : null
    if (!f || pack.meta?.retriever_config_sha256 !== f.sha256) { console.error('Modalidad B: el paquete no corresponde a la configuración de recuperación congelada.'); process.exit(2) } } }
const cellsFilter = arg('cells', false) ? new Set(JSON.parse(fs.readFileSync(String(arg('cells')), 'utf8'))) : null
const system = (nonce) => `${manual}\n\n[ref: ${nonce}]`
const userMsg = (c) => `PREGUNTA: ${c.item}\nCONTEXTO: ${c.context}\nPARTIDO: ${c.party}\n\nPASAJES DEL PROGRAMA (idioma: ${c.language}):\n${c.passages.map((p, i) => `[${i + 1}] (pág. ${p.page}) ${p.text}`).join('\n\n') || '(sin pasajes)'}\n\nResponde solo con el objeto JSON del manual.`
const PROMPT_SHA = sha(system('X') + userMsg({ item: 'I', context: 'C', party: 'P', language: 'es', passages: [] }) + MANUAL_VERSION + sha(manual))
const set = arg('set', 'S'), modality = String(arg('modality', 'A')).toUpperCase(); if (set === 'E') { console.error('E no se usa en esta fase.'); process.exit(2) }
const cells = (pack[set] ?? []).filter((c) => (modality === 'B' || c.passagesA) && (!cellsFilter || cellsFilter.has(c.cellId))).map((c) => ({ ...c, passages: modality === 'A' ? c.passagesA : c.passagesB })).slice(0, +arg('limit', 1e9))
const repeats = +arg('repeats', 2)
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-cli-'))   // directorio vacío por evaluador
const EVAL = {
  'codex-gpt-6.2-sol': { provider: 'codex-cli', vendor: 'OpenAI (Codex; mismo proveedor que GPT-OSS)', requested: 'gpt-6.2-sol (esfuerzo de razonamiento bajo)', timeoutMs: 300000, budget: 2_000_000,
    cmd: 'codex', args: () => ['exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '-s', 'read-only', '-C', scratch + '/codex', '--skip-git-repo-check', '--json', '-m', 'gpt-6.2-sol', '-c', 'model_reasoning_effort="low"', '-'], stdin: true,
    parse: (out) => { let text = '', usage = {}; for (const l of out.split('\n')) { try { const e = JSON.parse(l); if (e.type === 'item.completed' && e.item?.type === 'agent_message') text = e.item.text; if (e.type === 'turn.completed') usage = { prompt_tokens: e.usage?.input_tokens, completion_tokens: e.usage?.output_tokens, total_tokens: (e.usage?.input_tokens ?? 0) + (e.usage?.output_tokens ?? 0) } } catch {} } return { text, usage, cost: null } } },
  'deepseek-v4.1-flash-opencode': { provider: 'opencode-cli', vendor: 'DeepSeek', requested: 'opencode/deepseek-v4.1-flash-free', timeoutMs: 300000, budget: 2_000_000,
    cmd: 'opencode', args: (p) => ['run', '-m', 'opencode/deepseek-v4.1-flash-free', '--format', 'json', p], stdin: false,
    parse: (out) => { let text = '', usage = {}, cost = 0, error = null; for (const l of out.split('\n')) { try { const e = JSON.parse(l); if (e.type === 'error') error = { type: e.error?.type, status: e.error?.status, message: String(e.error?.message ?? '').slice(0, 160), retryAfterMs: e.error?.retryAfterMs }; if (e.type === 'text') text += e.part?.text ?? ''; if (e.type === 'step_finish') { cost += e.part?.cost ?? 0; usage = { prompt_tokens: e.part?.tokens?.input, completion_tokens: e.part?.tokens?.output, total_tokens: (e.part?.tokens?.input ?? 0) + (e.part?.tokens?.output ?? 0) } } } catch {} } return { text, usage, cost, error } } },
  'gemini-4-hydrogen-agy': { provider: 'agy-cli', vendor: 'Google (Gemini 4 Hydrogen vía Antigravity)', requested: 'gemini-4-hydrogen-low', timeoutMs: 300000, budget: 2_000_000,
    cmd: 'agy', args: (p) => ['-p', p, '--model', 'gemini-4-hydrogen-low', '--output-format', 'json'], stdin: false,
    parse: (out) => { try { const e = JSON.parse(out.slice(out.indexOf('{"conversation_id"') >= 0 ? out.indexOf('{"conversation_id"') : 0)); if (e.status === 'ERROR' || e.finished_reason === 'error') return { text: '', usage: {}, cost: null, error: { type: /quota|RESOURCE_EXHAUSTED|429/i.test(String(e.error)) ? 'provider.free-limit' : 'agy.error', status: /quota|429/i.test(String(e.error)) ? 429 : 500, message: String(e.error ?? '').slice(0, 160) } }; return { text: e.response ?? '', usage: { prompt_tokens: e.usage?.input_tokens, completion_tokens: (e.usage?.output_tokens ?? 0) + (e.usage?.thinking_tokens ?? 0), total_tokens: e.usage?.total_tokens }, cost: null } } catch { return { text: '', usage: {}, cost: null } } } },
}
for (const k of Object.keys(EVAL)) fs.mkdirSync(path.join(scratch, EVAL[k].provider.split('-')[0]), { recursive: true })
const only = arg('evaluators', false) ? String(arg('evaluators')).split(',') : Object.keys(EVAL)
if (flag('dry-run')) { console.log(JSON.stringify({ set, modality, cells: cells.length, repeats, evaluadores: only, llamadas: cells.length * repeats * only.length, promptSha: PROMPT_SHA.slice(0, 12), manualVersion: MANUAL_VERSION }, null, 1)); process.exit(0) }
if (!flag('confirm-authorized')) { console.error('Falta --confirm-authorized: no se lanza sin autorización expresa.'); process.exit(2) }
const outFile = path.join(OUT, `benchmark_${set}_${modality}.jsonl`)
const done = new Map(); if (fs.existsSync(outFile)) for (const l of fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (r.halted) continue; const k = `${r.cellId}|${r.evaluator_label}|${r.repeat}`; const o = done.get(k) ?? { n: 0, final: false }; o.n++; const legacyEmpty = r.execution_status === 'invalid_output' && r.error_detail === 'respuesta vacía' && !r.usage?.total_tokens
  if (!['timeout', 'api_error', 'rate_limited'].includes(r.execution_status) && !legacyEmpty) o.final = true; done.set(k, o) }
const flat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const verifyQuote = (q, c) => { if (!q) return null; const f = flat(q), all = flat(c.passages.map((p) => p.text).join(' ')); if (f && all.includes(f)) return 'exact'; const w = f.split(' ').filter((x) => x.length > 3); return w.length && w.filter((x) => all.includes(x)).length / w.length >= 0.8 ? 'fuzzy' : 'none' }
const VALID = { supports: [1, 2], opposes: [-2, -1], explicit_neutral: [0], not_mentioned: [null], ambiguous: [null] }
const run = (ev, prompt) => new Promise((resolve) => { const p = spawn(ev.cmd, ev.args(prompt), { cwd: scratch + '/' + ev.provider.split('-')[0], stdio: [ev.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] }); let out = '', err = ''; const t = setTimeout(() => { p.kill('SIGKILL'); resolve({ timeout: true, out, err }) }, ev.timeoutMs); p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d)); p.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }) }); if (ev.stdin) p.stdin.end(prompt) })
const summary = {}
await Promise.all(only.map(async (label) => {
  const ev = EVAL[label]; const sm = (summary[label] = { llamadas: 0, ok: 0, fallos: 0, omitidas: 0, parada: null }); let used = 0, consec = 0
  for (const c of cells) for (let k = 1; k <= repeats; k++) {
    const d = done.get(`${c.cellId}|${label}|${k}`); if (d && (d.final || d.n >= 3)) { sm.omitidas++; continue }
    if (used >= ev.budget) { sm.parada = `presupuesto de tokens agotado (${used}/${ev.budget})`; break }
    const t0 = Date.now(); const prompt = system(crypto.randomUUID()) + '\n\n---\n\n' + userMsg(c)
    const rec = { max_tokens: null, run_id: crypto.randomUUID(), cellId: c.cellId, set, modality, evidence_scope: modality === 'A' ? 'reference_evidence_plus_distractors' : 'passages_retrieved', repeat: k, evaluator_label: label, evaluator_kind: 'ai', provider: ev.provider, model_family: ev.vendor, model_requested: ev.requested, model_actual: ev.requested, model_actual_source: 'solicitado (la CLI no devuelve el modelo ejecutado)', fallback_used: false, manual_version: MANUAL_VERSION, prompt_version: PROMPT_SHA.slice(0, 12), item_text_sha256: sha(c.item), blind: true, independent_of: [], stratum: c.stratum, party: c.party, language: c.language, attempts_this_run: 1, via: 'cli', mensaje_unico: true }
    const r = await run(ev, prompt); rec.latency_ms = Date.now() - t0
    if (r.timeout) { rec.execution_status = 'timeout'; rec.error_detail = `superado el tiempo (${ev.timeoutMs / 1000} s)` }
    else if (r.code !== 0 && !r.out) { rec.execution_status = 'api_error'; rec.error_detail = String(r.err).slice(0, 200) }
    else {
      const { text, usage, cost, error } = ev.parse(r.out); rec.usage = usage;
      if (error) { rec.execution_status = /free-limit|429/.test(String(error.type) + error.status) ? 'rate_limited' : 'api_error'; rec.error_detail = `${error.type ?? ''} ${error.status ?? ''} ${error.message}`.trim(); rec.retry_after_ms = error.retryAfterMs ?? null; rec.omniroute = { cost_usd: null }; fs.appendFileSync(outFile, JSON.stringify(rec) + '\n'); sm.llamadas++; sm.fallos++; consec++; if (consec >= 3) { sm.parada = `límite de cuota o error técnico repetido (${rec.error_detail.slice(0, 90)})`; break } continue }
      consec = 0; rec.omniroute = { cost_usd: cost === null ? null : String(cost) }; rec.cost_nonzero = (cost ?? 0) > 0; used += usage?.total_tokens ?? 0
      let p = null; try { p = JSON.parse(String(text).replace(/^\s*```(json)?|```\s*$/g, '').trim()) } catch {}
      if (!(p && p.document_class in VALID && VALID[p.document_class].includes(p.intensity ?? null))) { rec.execution_status = 'invalid_output'; rec.error_detail = text ? 'JSON o valores no válidos' : 'respuesta vacía'; rec.raw_preview = String(text).slice(0, 300) }
      else { rec.execution_status = 'ok'; Object.assign(rec, { document_class: p.document_class, intensity: p.intensity ?? null, quote: p.quote ?? null, page: p.page ?? null, rationale: String(p.rationale ?? '').slice(0, 400), quote_verified: verifyQuote(p.quote, c) }) }
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n'); sm.llamadas++; if (rec.execution_status === 'ok') sm.ok++; else sm.fallos++
    if (rec.cost_nonzero) { sm.parada = `coste distinto de cero (${rec.omniroute.cost_usd} USD)`; break }
  }
  if (sm.parada) fs.appendFileSync(outFile, JSON.stringify({ halted: true, group: ev.provider, model: label, reason: sm.parada, at: new Date().toISOString() }) + '\n')
}))
fs.rmSync(scratch, { recursive: true, force: true }); console.log('Terminado.', JSON.stringify(summary))
