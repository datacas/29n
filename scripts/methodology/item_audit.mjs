// Fase 0 · Auditoría de ítems (solo lectura). Combina comprobaciones léxicas deterministas con los juicios
// adversariales de docs/methodology/local/item_audit_judgments.mjs. Las comprobaciones léxicas NO deciden: solo marcan.
import { loadRelease, usable, write, pct } from './lib.mjs'

// Los juicios adversariales son locales (no se publican): sin ellos el script solo ejecuta las marcas léxicas.
let JUDGMENTS = []
try { ({ JUDGMENTS } = await import('../../docs/methodology/local/item_audit_judgments.mjs')) } catch { console.warn('Sin juicios locales: solo marcas léxicas.') }
const version = process.argv[2] ?? '2.1.2'
const r = loadRelease(version)
const Q = r.questions
const hold = {}
for (const p of r.positions.filter(usable)) (hold[p.questionId] ??= []).push(p.value)

const CONJ = /\s(y|e|o|u)\s|,\s/i
const NO_DIR = /\b(reformarse|modificarse|intervenir|cambiarse|revisarse|priorizar)\b/i
const ABS = /\b(toda|todo|todos|todas|cualquier|nunca|siempre)\b/i
const STATUS_QUO = /\bmantenerse\b/i
const PURPOSE = /\b(para (que )?(reducir|no frenar|garantizar|hacer|bajar|proteger|evitar|recuperar|favorecer|dar)|con el fin de)\b/i
const LOADED = [[/masificad/i, 'masificado'], [/descontrolad/i, 'descontrolado'], [/ley mordaza/i, 'ley mordaza'], [/gran(es)? fortuna/i, 'grandes fortunas'], [/hist[oó]ric/i, 'históric-']]
const tok = (s) => new Set(s.toLowerCase().replace(/[¿?.,()«»]/g, '').split(/\s+/).filter((w) => w.length > 3 && !['debe', 'deben', 'para', 'sobre', 'como', 'frente', 'entre', 'ampliarse', 'aumentarse', 'reducirse'].includes(w)))
const T = Q.map((q) => tok(q.canonicalText))

const det = Q.map((q, i) => {
  const t = q.canonicalText.replace(/^¿|\?$/g, '')
  const f = []
  if (CONJ.test(t)) f.push('léxico: conjunción/enumeración')
  if (NO_DIR.test(t)) f.push('léxico: verbo sin dirección')
  if (ABS.test(t)) f.push('léxico: absoluto')
  if (STATUS_QUO.test(t)) f.push('léxico: statu quo')
  if (PURPOSE.test(t)) f.push('léxico: cláusula de finalidad')
  for (const [re, n] of LOADED) if (re.test(q.canonicalText)) f.push(`léxico: término cargado (${n})`)
  const ctxLoaded = LOADED.filter(([re]) => re.test(q.contextText ?? '')).map(([, n]) => n)
  if (ctxLoaded.length) f.push(`contexto: término cargado (${ctxLoaded.join(', ')})`)
  const words = t.split(/\s+/).length
  if (words > 22) f.push(`longitud: ${words} palabras`)
  const longw = t.split(/\s+/).filter((w) => w.replace(/[^a-záéíóúñ]/gi, '').length >= 13).length
  if (longw >= 2) f.push('comprensibilidad: ≥2 palabras de ≥13 letras')
  const v = hold[q.questionId] ?? []
  const disc = v.length >= 3 && v.every((x) => x > 0) ? 'sin posición negativa' : null
  return { n: i + 1, questionId: q.questionId, text: q.canonicalText, dim: q.dimensionCode, theme: q.themeCode, parties: v.length, flags: f, discrimination: disc }
})
// redundancia léxica (solo orientativa)
const pairs = []
for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) {
  let it = 0; T[i].forEach((x) => T[j].has(x) && it++)
  const s = it / (T[i].size + T[j].size - it)
  if (s >= 0.4) pairs.push({ a: i + 1, b: j + 1, jaccard: +s.toFixed(2) })
}
const sameTheme = {}
Q.forEach((q, i) => (sameTheme[q.themeCode] ??= []).push(i + 1))

// juicios: comprobación de deriva por comienzo de texto
const drift = []
const jd = {}
for (const [n, start, cls, issue, counter, fix] of JUDGMENTS) {
  if (Number.isInteger(n)) {
    const q = Q[n - 1]
    if (!q || (start && !q.canonicalText.startsWith(start))) { drift.push({ n, expected: start, found: q?.canonicalText }); continue }
  }
  ;(jd[Math.floor(n)] ??= []).push({ cls, issue, counter, fix })
}
const rows = det.map((d) => ({ ...d, judgments: jd[d.n] ?? [] }))
const count = (c) => rows.filter((x) => x.judgments.some((j) => j.cls === c)).length
const A = rows.filter((x) => x.judgments.some((j) => j.cls === 'A'))
const summary = {
  release: version, sha256: r._sha256, items: Q.length,
  claseA_doble_contenido: count('A'), claseB_objeto_compuesto: count('B'), claseV_vago_sin_direccion: count('V'), claseS_alcance_presuposicion: count('S'), claseC_contexto: count('C'), claseR_redundancia: count('R'),
  sinJuicio: rows.filter((x) => !x.judgments.length).length,
  lexicalFlagsOnly: rows.filter((x) => !x.judgments.length && x.flags.length).length,
  lexicalFalseNegatives_A: A.filter((x) => !x.flags.some((f) => f.includes('conjunción'))).map((x) => x.n),
  lexicalFlagged_A: A.filter((x) => x.flags.some((f) => f.includes('conjunción'))).length,
  driftErrors: drift.length, lexicalRedundancyPairs: pairs, themesWithSeveralItems: Object.fromEntries(Object.entries(sameTheme).filter(([, v]) => v.length >= 3)),
}
write('auditoria_items.json', { summary, drift, items: rows })
const tbl = (cls) => rows.filter((x) => x.judgments.some((j) => j.cls === cls)).map((x) => { const j = x.judgments.find((y) => y.cls === cls); return `| Q${x.n} | ${x.text} | ${j.issue} | ${j.counter} | ${j.fix} |` }).join('\n')
write('auditoria_items.md', `# Auditoría de ítems — release ${version} (fase 0, sin validar por humanos)\n\nGenerado por \`scripts/methodology/item_audit.mjs\` (sha256 \`${r._sha256.slice(0, 12)}…\`). Combina marcas léxicas deterministas y juicios adversariales de Claude (\`docs/methodology/local/item_audit_judgments.mjs\`). **Los números Qn son el orden del release 2.1.2, no los códigos Q0xx del banco.** Cada juicio debe pasar por la segunda codificación y revisión humana antes de actuar.\n\n- Doble contenido probable (A): **${summary.claseA_doble_contenido}** de ${summary.items} (${pct(summary.claseA_doble_contenido / summary.items)}). Objeto compuesto a revisar (B): ${summary.claseB_objeto_compuesto}. Vagos/sin dirección (V): ${summary.claseV_vago_sin_direccion}. Alcance/presuposición (S): ${summary.claseS_alcance_presuposicion}.\n- El método léxico (conjunciones y comas) marca ${summary.lexicalFlagged_A} de las ${summary.claseA_doble_contenido} de clase A y deja sin marcar: ${summary.lexicalFalseNegatives_A.map((n) => 'Q' + n).join(', ') || 'ninguna'}. Además marca ${summary.lexicalFlagsOnly} ítems que no tienen juicio de problema: no es una prueba suficiente (coincide con la advertencia del feedback).\n- Deriva de juicios (texto cambiado): ${summary.driftErrors}.\n\n## A · Doble contenido probable\n| Ítem | Texto | Problema | Contraejemplo | Propuesta |\n|---|---|---|---|---|\n${tbl('A')}\n\n## B · Objeto compuesto (probablemente una sola proposición)\n| Ítem | Texto | Problema | Contraejemplo | Propuesta |\n|---|---|---|---|---|\n${tbl('B')}\n\n## V · Vagos o sin dirección\n| Ítem | Texto | Problema | Contraejemplo | Propuesta |\n|---|---|---|---|---|\n${tbl('V')}\n\n## S · Alcance, presuposición o statu quo\n| Ítem | Texto | Problema | Contraejemplo | Propuesta |\n|---|---|---|---|---|\n${tbl('S')}\n\n## C · Contexto que añade elementos\n| Ítem | Texto | Problema | Contraejemplo | Propuesta |\n|---|---|---|---|---|\n${tbl('C')}\n\n## R · Redundancia\n| Ítem | Texto | Problema | Contraejemplo | Propuesta |\n|---|---|---|---|---|\n${tbl('R')}\n\nPares léxicos con Jaccard ≥0,4: ${pairs.map((p) => `Q${p.a}/Q${p.b}`).join(', ') || 'ninguno'} (el método léxico no detecta redundancia semántica).\n\n## Limitaciones\n- Auditoría hecha por un solo evaluador (Claude), no ciega y con conocimiento del feedback. Debe repetirse con otras familias de modelos y contrastarse con humanos.\n- Exhaustividad de respuestas: solo se construyeron contraejemplos para los ítems con problema; los demás no se declaran válidos, solo «sin hallazgo» en esta pasada.\n- No se evaluó la comprensibilidad con usuarios (requiere entrevistas cognitivas) ni la traducción.\n`)
console.log(JSON.stringify({ ...summary, lexicalRedundancyPairs: undefined, themesWithSeveralItems: undefined }, null, 1))
