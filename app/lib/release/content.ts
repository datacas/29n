/**
 * Contenido público de un release (preguntas, partidos, posiciones aprobadas y dimensiones).
 * Sin dependencias de Nuxt: lo usan el endpoint público y el script que construye el release.
 *
 * Un release PUBLICADO sirve el contenido congelado en su manifiesto (manifest_jsonb.content);
 * solo los releases antiguos sin `content` (la demo) se leen en vivo de las tablas editables.
 */
export type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>

export interface ReleaseContent {
  questions: any[]
  entities: any[]
  positions: any[]
  dimensions: any[]
}

const GENERIC_SUMMARY = /claims? extra[ií]dos?/i

export async function loadReleaseContent(query: QueryFn, releaseId: string): Promise<ReleaseContent> {
  const { rows: questionRows } = await query(
    `SELECT q.id AS question_id, q.canonical_text, q.answer_type, q.options, q.depth_level, q.theme_code, q.regional_parties, q.context_text,
            t.name AS topic_name, t.code AS topic_code,
            d.id AS dimension_id, d.name AS dimension_name, d.code AS dimension_code
       FROM release_questions rq
       JOIN questions q ON q.id = rq.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       LEFT JOIN dimensions d ON d.id = t.dimension_id
      WHERE rq.release_id = $1
      ORDER BY d.code, t.code, q.depth_level, q.pilot_question_id`,
    [releaseId]
  )
  const { rows: entityRows } = await query(
    `SELECT e.id AS entity_id, e.name, e.type, e.is_historical, e.period_label, e.country, e.description
       FROM release_entities re JOIN entities e ON e.id = re.entity_id
      WHERE re.release_id = $1 ORDER BY e.name`,
    [releaseId]
  )
  const { rows: positionRows } = await query(
    `SELECT p.entity_id, p.question_id, p.value, p.categorical_value, p.stance_status, p.conditions,
            p.evidence_summary, p.not_comparable_reason, p.claim_id, p.evidence_jsonb,
            c.literal_text AS claim_text,
            sp.page AS claim_page,
            COALESCE(s.title, (SELECT s2.title FROM sources s2 WHERE s2.entity_id = p.entity_id AND s2.type = 'program'
                                ORDER BY s2.created_at DESC LIMIT 1)) AS source_title
       FROM positions p
       JOIN release_questions rq ON rq.question_id = p.question_id
       JOIN release_entities re ON re.entity_id = p.entity_id
       LEFT JOIN claims c ON c.id = p.claim_id
       LEFT JOIN source_passages sp ON sp.id = (SELECT ce.passage_id FROM claim_evidence ce WHERE ce.claim_id = p.claim_id LIMIT 1)
       LEFT JOIN sources s ON s.id = c.source_id
      WHERE rq.release_id = $1 AND re.release_id = $1 AND p.review_status = 'approved'
      ORDER BY p.question_id, p.entity_id`,
    [releaseId]
  )
  const { rows: dimensionRows } = await query(
    `SELECT DISTINCT d.id, d.name, d.code
       FROM release_questions rq JOIN questions q ON q.id = rq.question_id
       JOIN topics t ON t.id = q.topic_id JOIN dimensions d ON d.id = t.dimension_id
      WHERE rq.release_id = $1 ORDER BY d.code`,
    [releaseId]
  )

  return {
    questions: questionRows.map((q) => ({
      questionId: q.question_id, canonicalText: q.canonical_text, answerType: q.answer_type, options: q.options,
      depthLevel: q.depth_level, themeCode: q.theme_code ?? null, contextText: q.context_text ?? null, regionalParties: q.regional_parties ?? [], topicName: q.topic_name, topicCode: q.topic_code,
      dimensionId: q.dimension_id, dimensionName: q.dimension_name, dimensionCode: q.dimension_code
    })),
    entities: entityRows.map((e) => ({
      entityId: e.entity_id, name: e.name, type: e.type, isHistorical: e.is_historical,
      periodLabel: e.period_label, country: e.country, description: e.description
    })),
    positions: positionRows.map((p) => {
      // Evidencia: las citas aprobadas de la revisión editorial (evidence_jsonb) o, en releases antiguos, la cita del claim
      const fromJson: Array<{ text: string; page: number | null; translation?: string | null }> = Array.isArray(p.evidence_jsonb)
        ? p.evidence_jsonb.filter((c: any) => c?.literal_text).map((c: any) => ({ text: c.literal_text, page: c.source_page ?? null, translation: c.translation_es ?? null }))
        : []
      const evidence = fromJson.length ? fromJson : p.claim_text ? [{ text: p.claim_text, page: p.claim_page ?? null }] : []
      return {
        entityId: p.entity_id, questionId: p.question_id, value: p.value, categoricalValue: p.categorical_value,
        stanceStatus: p.stance_status, conditions: p.conditions,
        // El resumen genérico del extractor ("2 claims extraídos…") no es información para el votante
        evidenceSummary: p.evidence_summary && !GENERIC_SUMMARY.test(p.evidence_summary) ? p.evidence_summary : null,
        notComparableReason: p.not_comparable_reason, claimId: p.claim_id,
        claimText: evidence[0]?.text ?? null, claimPage: evidence[0]?.page ?? null,
        evidence, sourceTitle: p.source_title ?? null
      }
    }),
    dimensions: dimensionRows.map((d) => ({ dimensionId: d.id, name: d.name, code: d.code }))
  }
}

export interface ReleaseRow {
  manifest_jsonb: any
  scoring_model_version: string
  version: string
  consultation_slug: string
  consultation_title: string
  consultation_description: string | null
  /** consultations.metadata: ajustes de la encuesta (tipo, umbral, nombre corto, sustantivo). */
  consultation_metadata?: any
}

/**
 * Ajustes de presentación propios de cada encuesta. Viven en consultations.metadata y se congelan en el manifiesto.
 * Todo es opcional: sin ellos, la encuesta se comporta como la del 29N.
 */
export interface ConsultationSettings {
  /** 'current' (programas actuales) o 'historical' (programas históricos) */
  kind: 'current' | 'historical'
  /** Nombre corto para el texto de compartir ("29N", "29N Historia") */
  shortName: string | null
  /** Cómo se llama a las entidades: "partido" o "programa" */
  entityNoun: { singular: string; plural: string }
  /** Mínimo de posiciones evaluables para no marcar "pocos datos" (null = el general) */
  minEvaluableQuestions: number | null
  /** Encuesta exhaustiva: la profundidad elige por nivel de pregunta y entran las de un solo programa */
  exhaustive: boolean
}

export function consultationSettings(meta: any): ConsultationSettings {
  const m = meta && typeof meta === 'object' ? meta : {}
  const min = Number.isInteger(m.minEvaluableQuestions) && m.minEvaluableQuestions > 0 ? m.minEvaluableQuestions : null
  return {
    kind: m.kind === 'historical' ? 'historical' : 'current',
    shortName: typeof m.shortName === 'string' && m.shortName.trim() ? m.shortName.trim() : null,
    entityNoun: {
      singular: typeof m.entityNoun?.singular === 'string' ? m.entityNoun.singular : 'partido',
      plural: typeof m.entityNoun?.plural === 'string' ? m.entityNoun.plural : 'partidos'
    },
    minEvaluableQuestions: min,
    exhaustive: m.exhaustive === true
  }
}

/** Payload público: contenido CONGELADO del manifiesto si existe; si no (releases antiguos), lectura en vivo. */
export async function buildReleasePayload(query: QueryFn, releaseId: string, row: ReleaseRow) {
  const frozen = row.manifest_jsonb?.content as ReleaseContent | undefined
  const content = frozen ?? (await loadReleaseContent(query, releaseId))
  return {
    releaseId,
    version: row.version,
    scoringModelVersion: row.scoring_model_version,
    consultation: {
      slug: row.manifest_jsonb?.consultation?.slug ?? row.consultation_slug,
      title: row.manifest_jsonb?.consultation?.title ?? row.consultation_title,
      description: row.manifest_jsonb?.consultation?.description ?? row.consultation_description,
      // Una versión con manifiesto usa solo sus ajustes congelados (los del 29N no tienen: valores por defecto).
      // El metadata vivo solo se usa sin manifiesto; si no, editarlo cambiaría una versión ya publicada.
      ...consultationSettings(row.manifest_jsonb?.consultation ? row.manifest_jsonb.consultation.settings : row.consultation_metadata)
    },
    frozen: !!frozen,
    ...content
  }
}
