-- SPIKE-12: registros de Jev, separados de las decisiones editoriales.
-- Esta tabla es solo informativa: ningún código la usa para cambiar positions.review_status.

CREATE TABLE IF NOT EXISTS jev_shadow_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id       uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  run_id            uuid NOT NULL,
  run_kind          text NOT NULL CHECK (run_kind IN ('benchmark', 'shadow')),
  mode              text NOT NULL CHECK (mode IN ('independent', 'with_proposal')),
  provider          text NOT NULL DEFAULT 'typesafe',
  model             text NOT NULL,            -- id pedido, p. ej. jev-1.14.0
  model_returned    text,                     -- id que devolvió la API
  decision          jsonb NOT NULL,           -- respuestas tipadas crudas, con probabilidades
  verdict           jsonb NOT NULL,           -- interpretación (JevVerdict)
  claude_class      text,                     -- postura propuesta por Claude en ese momento
  jev_class         text,                     -- clase de Jev (null = abstención)
  triage_group      text CHECK (triage_group IN ('high_confidence', 'doubtful', 'contradictory')),
  triage_reasons    jsonb,
  quote_statuses    jsonb,
  input_tokens      integer,
  latency_ms        integer,
  cost_usd          numeric(12, 8),
  created_at        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jev_reviews_position ON jev_shadow_reviews (position_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jev_reviews_run ON jev_shadow_reviews (run_id);
