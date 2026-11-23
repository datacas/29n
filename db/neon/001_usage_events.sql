-- Neon (producción): la web pública solo guarda estadísticas anónimas de uso.
-- Sin IP, sin respuestas, sin resultados y sin identificadores. Ejecutar una vez en la consola SQL de Neon.
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event       TEXT NOT NULL CHECK (event IN ('survey_started', 'survey_completed')),
  release_id  UUID,
  props       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS usage_events_created_idx ON usage_events (created_at);
CREATE INDEX IF NOT EXISTS usage_events_event_idx ON usage_events (event, created_at);

-- Consulta de resumen (equivale a la pantalla «Estadísticas de uso» del panel local):
--   SELECT to_char(created_at AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD') AS dia,
--          count(*) FILTER (WHERE event='survey_started')   AS inician,
--          count(*) FILTER (WHERE event='survey_completed') AS terminan
--     FROM usage_events GROUP BY 1 ORDER BY 1 DESC;
