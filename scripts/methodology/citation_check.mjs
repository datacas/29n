// Comprobación de citas de los evaluadores de IA contra los pasajes que recibieron (LOCAL, solo lectura; no llama a modelos ni cambia resultados previos).
// Motivo: la comprobación original de la modalidad B (`quote_verified`) marca «fuzzy» si ≥ 80 % de las palabras de la cita aparecen EN ALGÚN SITIO de la unión de todos los pasajes
// (bolsa de palabras), lo que deja pasar citas no literales. Esta comprobación es más estricta y por niveles:
//   literal            la cita (normalizada: mayúsculas, acentos, espacios, guiones de corte) aparece íntegra en UN pasaje
//   fragmentos         la cita con elipsis («…», «...») cuyos fragmentos son literales
//   casi_literal       el 90 % o más de la secuencia de palabras coincide con un pasaje (diferencias menores) → se listan las palabras que no están
//   dispersa           las palabras aparecen pero NO de forma contigua en un mismo pasaje (cita recompuesta) → SOSPECHOSA
//   no_encontrada      menos del 60 % de las palabras está en los pasajes
// Además: palabras de la cita que no existen en ningún pasaje (inventadas o traducidas) y página citada vs. página del pasaje.
//   node scripts/methodology/citation_check.mjs [--cells 19,6]     (números de orden de la campaña piloto; por defecto resumen global de la modalidad B)
import fs from 'node:fs'
import path from 'node:path'
import { OUT, ROOT } from './lib.mjs'
import { tokens, fold } from './retrieval.mjs'

const flat = (s) => fold(String(s ?? '')).replace(/-\s+/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()
const words = (s) => flat(s).split(' ').filter(Boolean)
const pack = JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark_pack_B_S.json'), 'utf8')); const byId = Object.fromEntries(pack.S.map((c) => [c.cellId, c]))
const recs = fs.readFileSync(path.join(OUT, 'benchmark_S_B.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && !(r.via === 'cli' && !r.usage?.total_tokens))
const lcsLen = (a, b) => { const m = Array(b.length + 1).fill(0); let best = 0; for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = m[j]; m[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0; if (m[j] > best) best = m[j]; prev = tmp } } return best }
// subsecuencia común más larga (no contigua) para «casi literal»
const lcsSeq = (a, b) => { const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]); return dp[a.length][b.length] }

export function checkQuote(quote, reportedPage, passages) {
  if (!quote || !String(quote).trim()) return { level: 'sin_cita' }
  const P = passages.map((p) => ({ page: p.page, f: flat(p.text), w: words(p.text) })); const all = new Set(P.flatMap((p) => p.w))
  const q = flat(quote); const qw = q.split(' ').filter(Boolean)
  const hit = P.find((p) => p.f.includes(q))
  if (hit) return { level: 'literal', passagePage: hit.page, pageOk: reportedPage == null ? null : Math.abs(hit.page - reportedPage) <= 1 }
  const frags = String(quote).split(/…|\.{3}|\[\.\.\.\]/).map(flat).filter((f) => f.split(' ').length >= 3)
  if (frags.length > 1 && frags.every((f) => P.some((p) => p.f.includes(f)))) return { level: 'fragmentos' }
  const best = P.map((p) => ({ p, k: lcsSeq(qw, p.w) })).sort((a, b) => b.k - a.k)[0]
  const missing = [...new Set(qw.filter((w) => !all.has(w) && w.length > 3))]
  const bow = qw.filter((w) => w.length > 3); const bowHit = bow.length ? bow.filter((w) => all.has(w)).length / bow.length : 0
  if (best && best.k / qw.length >= 0.9) return { level: 'casi_literal', passagePage: best.p.page, palabrasAusentes: missing, pageOk: reportedPage == null ? null : Math.abs(best.p.page - reportedPage) <= 1 }
  if (bowHit >= 0.6) return { level: 'dispersa', palabrasAusentes: missing, mejorPasajeCubre: best ? +(best.k / qw.length).toFixed(2) : 0 }
  return { level: 'no_encontrada', palabrasAusentes: missing }
}
if (process.argv[1].endsWith('citation_check.mjs')) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : null }
  const first = {}; for (const r of recs) { const k = r.cellId + '|' + r.evaluator_label; if (!first[k] || r.repeat < first[k].repeat) first[k] = r }
  const rows = Object.values(first).map((r) => { const c = byId[r.cellId]; return { r, c, chk: checkQuote(r.quote, r.page, c.passagesB), } })
  const tab = {}; for (const x of rows) { const k = x.r.evaluator_label; (tab[k] ??= {}); tab[k][x.chk.level] = (tab[k][x.chk.level] ?? 0) + 1 }
  console.log('Niveles por evaluador (primera repetición):'); console.table(tab)
  const old = {}; for (const x of rows) { const k = `${x.r.quote_verified}→${x.chk.level}`; old[k] = (old[k] ?? 0) + 1 }; console.log('Comprobación antigua → nueva:', old)
  const sus = rows.filter((x) => ['dispersa', 'no_encontrada', 'casi_literal'].includes(x.chk.level) || x.chk.pageOk === false)
  console.log(`\nCitas a revisar: ${sus.length}`)
  const cells = arg('cells') ? arg('cells').split(',').map(Number) : null
  const pilot = JSON.parse(fs.readFileSync(path.join(OUT, 'pilot_cells.json'), 'utf8')).cells.map((c) => c.cellId)
  const ordOf = (id) => pilot.indexOf(id) + 1
  for (const x of sus.filter((x) => !cells || cells.includes(ordOf(x.r.cellId)))) console.log(`- ${x.r.evaluator_label} · celda ${x.r.cellId.slice(0, 8)} · ${x.chk.level}${x.chk.pageOk === false ? ' · PÁGINA DISTINTA' : ''}${x.chk.palabrasAusentes?.length ? ' · palabras ausentes: ' + x.chk.palabrasAusentes.join(', ') : ''}\n    «${String(x.r.quote).slice(0, 150)}»`)
  console.log('\nLímite: esta comprobación verifica que la CITA sea literal y proceda de los pasajes; NO detecta que la justificación afirme algo que el texto no dice (eso requiere revisión humana).')
  fs.writeFileSync(path.join(OUT, 'citation_check_B.json'), JSON.stringify(rows.map((x) => ({ cellId: x.r.cellId, evaluator: x.r.evaluator_label, ...x.chk })), null, 1))
}
