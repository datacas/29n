import { query } from '~/server/utils/db'
import { requireAdmin } from '~/server/utils/auth'
import { QUESTION_DIMENSION_MAP } from '~/server/utils/dimensions'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { rows: partyRows } = await query(`SELECT DISTINCT e.name FROM entities e JOIN positions p ON p.entity_id = e.id JOIN questions q ON q.id = p.question_id WHERE e.type = 'party' AND q.pilot_question_id IS NOT NULL ORDER BY e.name`)
  const parties: string[] = partyRows.map((r: any) => r.name)

  // Get all pilot questions with their dimensions
  const questionsResult = await query(
    `SELECT q.pilot_question_id, q.canonical_text, d.code as dimension_code, d.name as dimension_name
     FROM questions q
     LEFT JOIN topics t ON q.topic_id = t.id
     LEFT JOIN dimensions d ON t.dimension_id = d.id
     WHERE q.pilot_question_id IS NOT NULL
     ORDER BY q.pilot_question_id`
  )

  // Get all positions with review_status
  const positionsResult = await query(
    `SELECT q.pilot_question_id, e.name as party, p.review_status, p.evidence_jsonb
     FROM positions p
     JOIN questions q ON p.question_id = q.id
     JOIN entities e ON p.entity_id = e.id
     WHERE q.pilot_question_id IS NOT NULL
       AND e.name = ANY($1)
     ORDER BY q.pilot_question_id, e.name`,
    [parties]
  )

  // Build position map
  const positionMap: Record<string, any> = {}
  for (const row of positionsResult.rows) {
    const key = `${row.pilot_question_id}-${row.party}`
    positionMap[key] = {
      review_status: row.review_status,
      has_evidence: row.evidence_jsonb !== null && row.evidence_jsonb.length > 0,
    }
  }

  // Calculate stats
  let approvedCount = 0
  let totalCount = 0
  const dimensionStats: Record<string, { approved: number; total: number }> = {}
  const partyStats: Record<string, { approved: number; total: number }> = {}
  const warnings: string[] = []

  for (const q of questionsResult.rows) {
    // Las preguntas piloto no tienen tema asociado: se usa el mapa de dimensiones del banco de preguntas
    const dim = q.dimension_name || QUESTION_DIMENSION_MAP[q.pilot_question_id] || 'Sin dimensión'
    if (!dimensionStats[dim]) dimensionStats[dim] = { approved: 0, total: 0 }
    // Total en celdas (pregunta × partido), la misma unidad que las aprobadas
    dimensionStats[dim].total += parties.length

    let qHasApproved = false

    for (const party of parties) {
      totalCount++
      if (!partyStats[party]) partyStats[party] = { approved: 0, total: 0 }
      partyStats[party].total++

      const pos = positionMap[`${q.pilot_question_id}-${party}`]
      if (pos && pos.review_status === 'approved' && pos.has_evidence) {
        approvedCount++
        dimensionStats[dim].approved++
        partyStats[party].approved++
        qHasApproved = true
      }
    }

    if (!qHasApproved) {
      warnings.push(`⚠️ ${q.pilot_question_id}: Sin posiciones aprobadas en ningún partido`)
    }
  }

  // Party coverage warnings
  for (const party of parties) {
    const stats = partyStats[party]
    const pct = stats.approved / stats.total * 100
    if (pct < 30) {
      warnings.push(`⚠️ ${party}: Cobertura baja (${pct.toFixed(0)}%)`)
    }
  }

  // Dimension coverage warnings
  for (const [dim, stats] of Object.entries(dimensionStats)) {
    const pct = stats.approved / stats.total * 100
    if (pct < 20) {
      warnings.push(`⚠️ ${dim}: Cobertura muy baja (${pct.toFixed(0)}%)`)
    }
  }

  if (approvedCount === 0) {
    warnings.push('⚠️ No hay posiciones aprobadas todavía')
  }

  const summary = [
    `Candidato de release preparado`,
    `Preguntas: ${questionsResult.rows.length}`,
    `Posiciones aprobadas: ${approvedCount}/${totalCount} (${(approvedCount / totalCount * 100).toFixed(1)}%)`,
    '',
    'Cobertura por dimensión:',
    ...Object.entries(dimensionStats).map(([dim, s]) => `  ${dim}: ${s.approved}/${s.total} (${(s.approved / s.total * 100).toFixed(0)}%)`),
    '',
    'Cobertura por partido:',
    ...Object.entries(partyStats).map(([party, s]) => `  ${party}: ${s.approved}/${s.total} (${(s.approved / s.total * 100).toFixed(0)}%)`),
    '',
    warnings.length > 0 ? `Advertencias (${warnings.length}):` : '',
    ...warnings,
  ].filter(Boolean).join('\n')

  return {
    approvedCount,
    totalCount,
    dimensionStats,
    partyStats,
    warnings,
    summary,
  }
})
