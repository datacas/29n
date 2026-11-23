/**
 * Segunda lectura de Jev sobre la INTENSIDAD (±1 o ±2) de las posiciones aprobadas, con los criterios de docs/guia-intensidad.md.
 * Solo lectura: no toca la base de datos. Entrada: un JSON de posiciones (id, pregunta, partido, valor_actual, citas).
 *
 *   node scripts/spike12/review_intensity.ts <entrada.json> <salida.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { JevClient, type QuestionSpec } from '../../app/lib/jev/client.ts'
import { requireKeyOrExplain } from './common.ts'
import { mapLimit } from './runner.ts'

requireKeyOrExplain()
const VALUE: Record<string, number | null> = { strongly_for: 2, partially_for: 1, neutral_explicit: 0, partially_against: -1, strongly_against: -2, no_responde: null }
const QUESTION: Record<string, QuestionSpec> = {
  intensidad: {
    type: 'choice',
    instructions:
      'Según SOLO las citas literales del programa, ¿cuál es la postura del partido ante la proposición TAL COMO ESTÁ FORMULADA? Mide cuánto toma partido el texto citado sobre esa proposición, no lo contundente que suene el partido en general. ' +
      'Si la medida citada no es la de la proposición (es otra cercana), la postura es parcial. Si las citas solo mencionan el tema o describen la situación, elige "no_responde".',
    criteria: {
      strongly_for: 'Las citas se comprometen a la medida exacta de la proposición con un verbo de compromiso claro (aprobaremos, derogaremos, garantizaremos, crearemos, eliminaremos) o con una cifra, un plazo o una norma concreta, sin condiciones ni alcance recortado.',
      partially_for: 'Las citas van en la dirección de la proposición, pero con un verbo vago (impulsaremos, promoveremos, fomentaremos, estudiaremos, defenderemos), con condiciones, de alcance parcial, como principio general sin medida concreta, o con una medida cercana pero no idéntica.',
      neutral_explicit: 'Las citas declaran expresamente neutralidad o presentan ambas opciones sin preferencia.',
      partially_against: 'Las citas se oponen a la proposición, pero con matices, condiciones, alcance parcial, como principio sin medida concreta, o solo a una versión cercana.',
      strongly_against: 'Las citas rechazan la medida exacta de la proposición, o proponen lo contrario, de forma clara y sin condiciones.',
      no_responde: 'Las citas solo mencionan el tema o describen la situación, o hablan de otra cosa: no permiten decir qué opina el partido de la proposición.'
    }
  }
}

const items = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Array<{ id: string; pregunta: string; partido: string; valor_actual: number; citas: Array<{ pag: number | null; texto: string }> }>
const client = new JevClient()
let tokens = 0
const out = await mapLimit(items, 4, async (it) => {
  const state = { proposicion: it.pregunta, partido: it.partido, citas: it.citas.map((c, i) => ({ n: i + 1, cita_literal: c.texto, pagina: c.pag })) }
  try {
    const r = await client.systemOne(state, QUESTION)
    tokens += r.usage.input_tokens
    const a: any = r.answers.intensidad
    const choice = a?.type === 'choice' && a.choice in VALUE ? a.choice : null
    return { id: it.id, actual: it.valor_actual, jev: choice ? VALUE[choice] : undefined, eleccion: choice, confianza: a?.confidence ?? null, probs: a?.probabilities ?? {} }
  } catch (e) {
    return { id: it.id, actual: it.valor_actual, jev: undefined, eleccion: null, confianza: null, probs: {}, error: String((e as Error).message).slice(0, 80) }
  }
})
writeFileSync(process.argv[3], JSON.stringify(out, null, 0))
const dist: Record<string, number> = {}
for (const o of out) dist[o.eleccion ?? 'error'] = (dist[o.eleccion ?? 'error'] ?? 0) + 1
console.log(`${out.length} posiciones, modelo ${client.model}, ~$${((tokens / 1e6) * 0.042).toFixed(4)}`, dist)
