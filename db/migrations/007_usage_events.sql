-- Estadísticas de uso anónimas: sin IP, sin identificadores, sin respuestas ni resultados.
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event       TEXT NOT NULL CHECK (event IN ('survey_started', 'survey_completed')),
  release_id  UUID,
  props       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS usage_events_created_idx ON usage_events (created_at);
CREATE INDEX IF NOT EXISTS usage_events_event_idx ON usage_events (event, created_at);
