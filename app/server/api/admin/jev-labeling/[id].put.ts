import { requireAdmin } from '~/server/utils/auth'
import { STANCES, readSample, writeSample } from '~/server/utils/labeling'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const stance = body?.stance
  const annotator = typeof body?.annotator === 'string' ? body.annotator.trim() : ''
  if (!(STANCES as readonly string[]).includes(stance)) {
    throw createError({ statusCode: 400, statusMessage: 'Postura no válida' })
  }
  if (!annotator || annotator.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Indica quién etiqueta (annotator)' })
  }
  const evidence = body?.evidenceSufficient
  if (evidence !== null && evidence !== undefined && typeof evidence !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'evidenceSufficient debe ser true, false o null' })
  }

  const sample = readSample()
  const item = sample.items.find((i: any) => i.position_id === id)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Posición no incluida en la muestra' })

  item.human = {
    stance,
    evidence_sufficient: evidence ?? null,
    annotator,
    notes: typeof body?.notes === 'string' ? body.notes.slice(0, 1000) : '',
    labeled_at: new Date().toISOString()
  }
  writeSample(sample)
  return { ok: true }
})
