// Ensambla el INFORME COMPLETO LOCAL (docs/methodology/local/INFORME_COMPLETO.md) a partir de los resultados generados. No se versiona.
// Reproducible: vuelve a ejecutar los análisis y concatena sus salidas. Los resultados detallados NO son públicos.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { OUT, ROOT } from './lib.mjs'
const run = (script, args = []) => { try { execFileSync('node', [path.join(ROOT, 'scripts/methodology', script), ...args], { stdio: 'pipe' }) } catch (e) { return `(no se pudo ejecutar ${script}: ${String(e.message).slice(0, 120)})` } return null }
const read = (f) => (fs.existsSync(path.join(OUT, f)) ? fs.readFileSync(path.join(OUT, f), 'utf8') : `(falta ${f})`)
const json = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) : null)
const notes = []
for (const f of ['benchmark_S_A.jsonl', 'benchmark_S_B.jsonl']) if (fs.existsSync(path.join(OUT, f))) { const n = run('benchmark_analyze.mjs', ['--file', path.join(OUT, f), ...(f.endsWith('_B.jsonl') ? ['--pack', 'benchmark_pack_B_S.json'] : [])]); if (n) notes.push(n); fs.copyFileSync(path.join(OUT, 'benchmark_analisis.json'), path.join(OUT, f.replace('.jsonl', '_analisis.json'))); fs.copyFileSync(path.join(OUT, 'benchmark_analisis.md'), path.join(OUT, f.replace('.jsonl', '_analisis.md'))) }
const sec = (t, b) => `\n\n---\n\n# ${t}\n\n${b}`
const stats = json('spike/stats_pareadas.json'); const trad = json('spike/results_traduccion.json'); const rr = json('spike/results_rerank.json')
const md = `# Informe completo local de la revisión metodológica de 29N\n\nGenerado el ${new Date().toISOString()} por \`build_full_report.mjs\`. **LOCAL: no se versiona ni se publica.** Contexto y decisiones: \`docs/methodology/proceso-completo.md\`.\n${notes.length ? '\nAvisos: ' + notes.join('; ') + '\n' : ''}`
  + sec('1. Auditoría de ítems (candidatos a revisión; un solo evaluador)', read('auditoria_items.md'))
  + sec('2. Asimetría de la codificación', read('asimetria.md')) + sec('3. Cobertura y reconciliación de denominadores', read('cobertura.md')) + sec('4. Sensibilidad del ranking (usuarios sintéticos)', read('sensibilidad.md'))
  + sec('5. Diagnóstico de recuperación', read('retrieval_diag.md'))
  + sec('6. Spike de embeddings, reordenador y traducción', '```json\n' + JSON.stringify({ rerank: rr, traduccion: trad }, null, 1) + '\n```\n\n### Comparaciones pareadas de recall\n```json\n' + JSON.stringify(stats, null, 1) + '\n```')
  + sec('7. Modalidad A: análisis por evaluador', read('benchmark_S_A_analisis.md')) + sec('8. Modalidad B: análisis por evaluador', read('benchmark_S_B_analisis.md'))
  + sec('9. Candidatas a auditoría de silencio (priorización, no omisiones)', '```json\n' + JSON.stringify((json('candidatas_auditoria_semantica.json') ?? {}).celdas?.slice(0, 80) ?? [], null, 1) + '\n```')
fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/INFORME_COMPLETO.md'), md); console.log('Escrito docs/methodology/local/INFORME_COMPLETO.md', Math.round(md.length / 1024) + ' KB')
