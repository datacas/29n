-- SPIKE-12: sugerencia de Jev para la postura (-2..+2) de cada posición aprobada.
-- Informativa: la decisión es humana y se guarda en positions.value. La pantalla la oculta por defecto.

CREATE TABLE IF NOT EXISTS jev_value_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id     uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  run_id          uuid NOT NULL,
  choice          text NOT NULL,            -- strongly_for | partially_for | neutral_explicit | partially_against | strongly_against | contradictory
  suggested_value integer,                  -- null si 'contradictory'
  confidence      numeric(5, 4),
  probabilities   jsonb,
  model           text NOT NULL,
  created_at      timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jev_value_sug_position ON jev_value_suggestions (position_id, created_at DESC);
