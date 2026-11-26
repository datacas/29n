// Modalidad B · selección PRE-REGISTRADA de celdas para el panel adicional (se aplica a los resultados del panel principal; no es una decisión dinámica).
// Regla: (1) celdas donde los evaluadores principales NO coinciden en la clase (cualquier discrepancia, incluida not_mentioned frente a una posición) o en el signo;
// (2) más una auditoría aleatoria del 25 % de las celdas unánimes (semilla 29), imprescindible para detectar errores compartidos por los modelos.
import fs from 'node:fs'
import path from 'node:path'
import { OUT, rng } from './lib.mjs'
const file = path.join(OUT, 'benchmark_S_B.jsonl'); const PRINCIPAL = ['llama-4-scout', 'codex-gpt-6.2-sol', 'deepseek-v4.1-flash-opencode', 'gemini-4-hydrogen-agy']
const recs = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.halted && r.execution_status === 'ok' && !r.fallback_used && PRINCIPAL.includes(r.evaluator_label))
const by = {}; for (const r of recs) (by[r.cellId] ??= {}); for (const r of recs) (by[r.cellId][r.evaluator_label] ??= []).push(r.document_class)
const disc = [], unan = []
for (const [id, m] of Object.entries(by)) { const first = Object.values(m).map((a) => a[0]); const all = Object.values(m).flat(); const sig = new Set(all.filter((c) => c === 'supports' || c === 'opposes')); (new Set(all).size > 1 || sig.size > 1 ? disc : unan).push(id) }
const rand = rng(29); const aud = unan.filter(() => rand() < 0.25)
const sel = [...disc, ...aud]; fs.writeFileSync(path.join(OUT, 'benchmark_B_stage2_cells.json'), JSON.stringify(sel))
console.log(JSON.stringify({ celdasConPanelPrincipal: Object.keys(by).length, discrepantes: disc.length, unanimes: unan.length, auditoriaAleatoria25pct: aud.length, seleccionadas: sel.length }))
