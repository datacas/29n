-- Seed: 002_demo_release
-- Demo data for E2E testing: 3 fictional entities, 6 dimensions, questions, positions, and evidence.
-- Idempotent: safe to run multiple times.
-- IMPORTANT: These are clearly marked as DEMO data, not real political positions.

-- ============================================
-- 1. Consultation
-- ============================================

INSERT INTO consultations (slug, title, description, category, base_locale)
VALUES ('demo-2026', 'Encuesta de demostración 2026',
        'Esta es una encuesta ficticia para pruebas de integración. Las entidades y posiciones no representan partidos reales.',
        'politics', 'es')
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title;

-- ============================================
-- 2. Entities (3 fictional parties)
-- ============================================

INSERT INTO entities (name, type, is_historical, period_label, country, description)
VALUES
  ('Partido Azul Demo', 'party', false, NULL, 'ES', 'Entidad ficticia para pruebas. Centro-derecha simulado.'),
  ('Partido Verde Demo', 'party', false, NULL, 'ES', 'Entidad ficticia para pruebas. Ecologista simulado.'),
  ('Partido Rojo Demo', 'party', false, NULL, 'ES', 'Entidad ficticia para pruebas. Centro-izquierda simulado.')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Sources (fictional documents for evidence)
-- ============================================

INSERT INTO sources (entity_id, title, type, storage_path, sha256_hash, language, year, status)
SELECT e.id, 'Programa electoral ficticio 2026 - ' || e.name, 'program',
       './storage/demo/' || e.name || '.pdf', '0000000000000000000000000000000000000000000000000000000000000000',
       'es', 2026, 'accepted'
FROM entities e
WHERE e.name IN ('Partido Azul Demo', 'Partido Verde Demo', 'Partido Rojo Demo')
  AND NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.entity_id = e.id AND s.title LIKE 'Programa electoral ficticio%'
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. Source passages (fictional evidence)
-- ============================================

INSERT INTO source_passages (source_id, page, article_ref, literal_text, normalized_text)
SELECT s.id, 1, 'Artículo 1',
       'DEMO: El ' || s.entity_id || ' propone reducir impuestos a las empresas para fomentar la inversión.',
       'Reducir impuestos a empresas'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Azul Demo'
  AND NOT EXISTS (
    SELECT 1 FROM source_passages sp WHERE sp.source_id = s.id AND sp.page = 1
  )
ON CONFLICT DO NOTHING;

INSERT INTO source_passages (source_id, page, article_ref, literal_text, normalized_text)
SELECT s.id, 2, 'Artículo 2',
       'DEMO: El ' || s.entity_id || ' propone aumentar la inversión en energías renovables un 50%.',
       'Aumentar inversión energías renovables'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Verde Demo'
  AND NOT EXISTS (
    SELECT 1 FROM source_passages sp WHERE sp.source_id = s.id AND sp.page = 2
  )
ON CONFLICT DO NOTHING;

INSERT INTO source_passages (source_id, page, article_ref, literal_text, normalized_text)
SELECT s.id, 3, 'Artículo 3',
       'DEMO: El ' || s.entity_id || ' propone universalizar la sanidad pública y aumentar el presupuesto sanitario.',
       'Universalizar sanidad pública'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Rojo Demo'
  AND NOT EXISTS (
    SELECT 1 FROM source_passages sp WHERE sp.source_id = s.id AND sp.page = 3
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Claims (fictional proposals)
-- ============================================

-- Economy claims
INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Reducción de impuestos corporativos del 25% al 20%.',
       'Reducir impuestos corporativos',
       'Sujeto a déficit público inferior al 3%.',
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Azul Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Reducir impuestos corporativos'
  )
ON CONFLICT DO NOTHING;

INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Inversión del 2% del PIB en energías renovables.',
       'Invertir 2% PIB en renovables',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Verde Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Invertir 2% PIB en renovables'
  )
ON CONFLICT DO NOTHING;

INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Aumento del presupuesto sanitario un 15%.',
       'Aumentar presupuesto sanitario',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Rojo Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Aumentar presupuesto sanitario'
  )
ON CONFLICT DO NOTHING;

-- Social claims
INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Reformar el sistema de pensiones manteniendo la jubilación a los 65.',
       'Mantener jubilación a 65 años',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Azul Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Mantener jubilación a 65 años'
  )
ON CONFLICT DO NOTHING;

INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Crear 100.000 viviendas públicas en 4 años.',
       'Crear 100.000 viviendas públicas',
       'Financiada con impuestos a grandes fortunas.',
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Rojo Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Crear 100.000 viviendas públicas'
  )
ON CONFLICT DO NOTHING;

-- Rights claims
INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Reforzar las libertades digitales con encriptación obligatoria.',
       'Reforzar libertades digitales',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Verde Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Reforzar libertades digitales'
  )
ON CONFLICT DO NOTHING;

-- Territory claims
INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Mantener el modelo territorial actual con mejoras en financiación autonómica.',
       'Mantener modelo territorial',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Azul Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Mantener modelo territorial'
  )
ON CONFLICT DO NOTHING;

-- Institutions claims
INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Reformar el sistema electoral con representación proporcional pura.',
       'Reforma sistema electoral',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Rojo Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Reforma sistema electoral'
  )
ON CONFLICT DO NOTHING;

-- Environment claims
INSERT INTO claims (source_id, literal_text, normalized_text, conditions, status)
SELECT s.id,
       'DEMO: Prohibir la extracción de combustibles fósiles en territorio nacional.',
       'Prohibir combustibles fósiles',
       NULL,
       'approved'
FROM sources s
WHERE s.title LIKE 'Programa electoral ficticio%Partido Verde Demo'
  AND NOT EXISTS (
    SELECT 1 FROM claims c WHERE c.source_id = s.id AND c.normalized_text = 'Prohibir combustibles fósiles'
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Claim evidence (links claims to passages)
-- ============================================

INSERT INTO claim_evidence (claim_id, passage_id, quote, support_type)
SELECT c.id, sp.id,
       'DEMO: Cita ficticia del ' || c.source_id || ' sobre ' || c.normalized_text,
       'direct'
FROM claims c
JOIN sources s ON s.id = c.source_id
JOIN source_passages sp ON sp.source_id = s.id
WHERE c.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM claim_evidence ce WHERE ce.claim_id = c.id
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. Questions (12 questions across 6 dimensions)
-- ============================================

-- Economy (2 questions)
INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'El Estado debería reducir los impuestos a las empresas para fomentar la inversión.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'economy.fiscal'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%reducir los impuestos a las empresas%'
  );

INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'El Estado debería aumentar la inversión en energías renovables.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'economy.fiscal'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%aumentar la inversión en energías renovables%'
  );

-- Social (2 questions)
INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'La edad de jubilación debería mantenerse en 65 años.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'social.health'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%edad de jubilación%'
  );

INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'El Estado debería construir viviendas públicas en cantidad significativa.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'social.housing'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%viviendas públicas%'
  );

-- Rights (2 questions)
INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'Las libertades digitales deberían reforzarse con encriptación obligatoria.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'rights.civil'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%libertades digitales%'
  );

INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'Se debería garantizar la igualdad de oportunidades sin distinción de género.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'rights.equality'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%igualdad de oportunidades%'
  );

-- Territory (2 questions)
INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'El modelo territorial actual debería mantenerse con mejoras en financiación.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'territory.model'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%modelo territorial actual%'
  );

INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'Las comunidades autónomas deberían tener más competencias.', 'scale', 2, 'published'
FROM topics t WHERE t.code = 'territory.model'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%comunidades autónomas%'
  );

-- Institutions (2 questions)
INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'El sistema electoral debería ser proporcional puro.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'institutions.system'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%sistema electoral%'
  );

INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'La justicia debería ser más independiente del poder político.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'institutions.justice'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%justicia independiente%'
  );

-- Environment (2 questions)
INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'Se debería prohibir la extracción de combustibles fósiles.', 'scale', 1, 'published'
FROM topics t WHERE t.code = 'environment.climate'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%prohibir la extracción%'
  );

INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
SELECT t.id, 'La transición energética debería ser prioritaria sobre el crecimiento económico.', 'scale', 2, 'published'
FROM topics t WHERE t.code = 'environment.energy'
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.topic_id = t.id AND q.canonical_text LIKE '%transición energética%'
  );

-- ============================================
-- 8. Positions (entity stances on questions)
-- ============================================

-- Helper: get entity IDs
WITH entities AS (
  SELECT id, name FROM entities WHERE name IN ('Partido Azul Demo', 'Partido Verde Demo', 'Partido Rojo Demo')
),
questions AS (
  SELECT id, canonical_text FROM questions WHERE status = 'published'
),
claims AS (
  SELECT id, source_id, normalized_text FROM claims WHERE status = 'approved'
),
sources AS (
  SELECT id, entity_id FROM sources WHERE title LIKE 'Programa electoral ficticio%'
)

-- Partido Azul Demo positions (economy, territory, institutions)
-- Use ON CONFLICT to handle idempotent re-runs
INSERT INTO positions (entity_id, question_id, claim_id, value, evidence_summary, review_status, stance_status)
SELECT e.id, q.id, c.id,
       CASE
         WHEN q.canonical_text LIKE '%reducir los impuestos%' THEN 2
         WHEN q.canonical_text LIKE '%modelo territorial actual%' THEN 2
         WHEN q.canonical_text LIKE '%edad de jubilación%' THEN 1
         ELSE 0
       END,
       'DEMO: Posición ficticia basada en ' || c.normalized_text,
       'approved', 'approved'
FROM entities e
CROSS JOIN questions q
JOIN sources s ON s.entity_id = e.id
JOIN claims c ON c.source_id = s.id
WHERE e.name = 'Partido Azul Demo'
  AND q.canonical_text LIKE ANY (ARRAY[
    '%reducir los impuestos%',
    '%modelo territorial actual%',
    '%edad de jubilación%'
  ])
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.entity_id = e.id AND p.question_id = q.id
  )
LIMIT 100
ON CONFLICT (entity_id, question_id) DO NOTHING;

-- Partido Verde Demo positions (environment, rights, economy)
INSERT INTO positions (entity_id, question_id, claim_id, value, evidence_summary, review_status, stance_status)
SELECT e.id, q.id, c.id,
       CASE
         WHEN q.canonical_text LIKE '%prohibir la extracción%' THEN 2
         WHEN q.canonical_text LIKE '%libertades digitales%' THEN 2
         WHEN q.canonical_text LIKE '%aumentar la inversión en energías renovables%' THEN 2
         WHEN q.canonical_text LIKE '%transición energética%' THEN 1
         ELSE 0
       END,
       'DEMO: Posición ficticia basada en ' || c.normalized_text,
       'approved', 'approved'
FROM entities e
CROSS JOIN questions q
JOIN sources s ON s.entity_id = e.id
JOIN claims c ON c.source_id = s.id
WHERE e.name = 'Partido Verde Demo'
  AND q.canonical_text LIKE ANY (ARRAY[
    '%prohibir la extracción%',
    '%libertades digitales%',
    '%aumentar la inversión en energías renovables%',
    '%transición energética%'
  ])
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.entity_id = e.id AND p.question_id = q.id
  )
LIMIT 100
ON CONFLICT (entity_id, question_id) DO NOTHING;

-- Partido Rojo Demo positions (social, institutions, economy)
INSERT INTO positions (entity_id, question_id, claim_id, value, evidence_summary, review_status, stance_status)
SELECT e.id, q.id, c.id,
       CASE
         WHEN q.canonical_text LIKE '%viviendas públicas%' THEN 2
         WHEN q.canonical_text LIKE '%sistema electoral%' THEN 2
         WHEN q.canonical_text LIKE '%igualdad de oportunidades%' THEN 1
         ELSE 0
       END,
       'DEMO: Posición ficticia basada en ' || c.normalized_text,
       'approved', 'approved'
FROM entities e
CROSS JOIN questions q
JOIN sources s ON s.entity_id = e.id
JOIN claims c ON c.source_id = s.id
WHERE e.name = 'Partido Rojo Demo'
  AND q.canonical_text LIKE ANY (ARRAY[
    '%viviendas públicas%',
    '%sistema electoral%',
    '%igualdad de oportunidades%'
  ])
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.entity_id = e.id AND p.question_id = q.id
  )
LIMIT 100
ON CONFLICT (entity_id, question_id) DO NOTHING;

-- ============================================
-- 9. Survey release (published)
-- ============================================

-- Create draft release first
INSERT INTO survey_releases (consultation_id, version, status, scoring_model_version)
SELECT c.id, 'demo-1.0', 'draft', '1.0.0'
FROM consultations c WHERE c.slug = 'demo-2026'
  AND NOT EXISTS (
    SELECT 1 FROM survey_releases sr WHERE sr.consultation_id = c.id AND sr.version = 'demo-1.0'
  )
ON CONFLICT (consultation_id, version) DO NOTHING;

-- Link all published questions to the release
INSERT INTO release_questions (release_id, question_id)
SELECT sr.id, q.id
FROM survey_releases sr
JOIN consultations c ON c.id = sr.consultation_id
JOIN questions q ON q.status = 'published'
WHERE c.slug = 'demo-2026' AND sr.version = 'demo-1.0'
  AND NOT EXISTS (
    SELECT 1 FROM release_questions rq WHERE rq.release_id = sr.id AND rq.question_id = q.id
  );

-- Link all 3 demo entities to the release
INSERT INTO release_entities (release_id, entity_id)
SELECT sr.id, e.id
FROM survey_releases sr
JOIN consultations c ON c.id = sr.consultation_id
JOIN entities e ON e.name IN ('Partido Azul Demo', 'Partido Verde Demo', 'Partido Rojo Demo')
WHERE c.slug = 'demo-2026' AND sr.version = 'demo-1.0'
  AND NOT EXISTS (
    SELECT 1 FROM release_entities re WHERE re.release_id = sr.id AND re.entity_id = e.id
  );

-- Publish the release with manifest
-- Use pgcrypto gen_random_uuid() style hash via encode(digest(..., 'sha256'), 'hex')
UPDATE survey_releases sr
SET
  status = 'published',
  published_at = NOW(),
  manifest_jsonb = jsonb_build_object(
    'version', 'demo-1.0',
    'scoring_model_version', '1.0.0',
    'question_ids', (
      SELECT jsonb_agg(rq.question_id ORDER BY rq.question_id)
      FROM release_questions rq
      WHERE rq.release_id = sr.id
    ),
    'entity_ids', (
      SELECT jsonb_agg(re.entity_id ORDER BY re.entity_id)
      FROM release_entities re
      WHERE re.release_id = sr.id
    ),
    'published_at', NOW()::text
  ),
  manifest_hash = encode(
    digest(
      jsonb_build_object(
        'version', 'demo-1.0',
        'scoring_model_version', '1.0.0',
        'question_ids', (
          SELECT jsonb_agg(rq.question_id ORDER BY rq.question_id)
          FROM release_questions rq
          WHERE rq.release_id = sr.id
        ),
        'entity_ids', (
          SELECT jsonb_agg(re.entity_id ORDER BY re.entity_id)
          FROM release_entities re
          WHERE re.release_id = sr.id
        ),
        'published_at', NOW()::text
      )::text,
      'sha256'
    ),
    'hex'
  )
WHERE sr.id = (
  SELECT sr2.id FROM survey_releases sr2
  JOIN consultations c ON c.id = sr2.consultation_id
  WHERE c.slug = 'demo-2026' AND sr2.version = 'demo-1.0' AND sr2.status = 'draft'
);

-- ============================================
-- Verification queries
-- ============================================

-- Check release is published
SELECT sr.id, sr.version, sr.status, sr.manifest_jsonb IS NOT NULL AS has_manifest, sr.manifest_hash IS NOT NULL AS has_hash
FROM survey_releases sr
JOIN consultations c ON c.id = sr.consultation_id
WHERE c.slug = 'demo-2026';

-- Check entities
SELECT e.name, COUNT(p.id) AS positions_count
FROM entities e
LEFT JOIN positions p ON p.entity_id = e.id AND p.review_status = 'approved'
WHERE e.name LIKE 'Partido % Demo'
GROUP BY e.name
ORDER BY e.name;

-- Check questions per dimension
SELECT d.code AS dimension, COUNT(q.id) AS questions
FROM questions q
JOIN topics t ON t.id = q.topic_id
JOIN dimensions d ON d.id = t.dimension_id
WHERE q.status = 'published'
GROUP BY d.code
ORDER BY d.code;
