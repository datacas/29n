-- Fase 1 de la validación metodológica: codificaciones de varios evaluadores por celda (pregunta × partido).
-- Migración ADITIVA y de solo añadir: no toca `positions` ni ninguna tabla existente. `positions` sigue siendo el
-- resultado adjudicado. Entorno: BD local de desarrollo/pruebas (no se aplica en Neon: allí solo hay usage_events).
-- Recuperación: ver docs/methodology/fase1/migracion-009.md (DROP TABLE position_codings + función, o pg_restore del backup).

CREATE TABLE IF NOT EXISTS position_codings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  run_id              uuid NOT NULL,
  entity_id           uuid NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  question_id         uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  release_id          uuid REFERENCES survey_releases(id) ON DELETE RESTRICT,

  -- Quién codifica. `model_actual` es el modelo que de verdad respondió (puede diferir del pedido si hubo fallback).
  evaluator_kind      text NOT NULL CHECK (evaluator_kind IN ('human', 'ai', 'verifier')),
  evaluator_label     text NOT NULL,
  provider            text,
  model_family        text,
  model_requested     text,
  model_actual        text,
  fallback_used       boolean NOT NULL DEFAULT false,
  blind               boolean NOT NULL DEFAULT true,
  independent_of      text[] NOT NULL DEFAULT '{}',   -- evaluadores cuyas respuestas NO vio (para auditar la ceguera)

  -- Qué se codificó: versiones exactas para poder reproducirlo.
  item_text_sha256    text NOT NULL,
  context_sha256      text,
  manual_version      text,
  prompt_version      text,
  source_sha256       text,                            -- huella del documento del partido
  config              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Estado técnico de la ejecución, SEPARADO de la clase documental: un fallo nunca es `not_mentioned`.
  execution_status    text NOT NULL DEFAULT 'ok' CHECK (execution_status IN
    ('ok', 'api_error', 'timeout', 'rate_limited', 'document_unavailable', 'extraction_incomplete', 'search_failed', 'invalid_output', 'refused')),
  error_detail        text,

  -- Resultado documental (solo si la ejecución fue correcta).
  document_class      text CHECK (document_class IN ('supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous')),
  intensity           smallint CHECK (intensity BETWEEN -2 AND 2),
  evidence            jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale           text,
  usage               jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tokens, latencia, coste

  -- La clase solo existe si la ejecución fue correcta, y la intensidad debe ser coherente con la clase.
  CONSTRAINT position_codings_status_class CHECK ((execution_status = 'ok') = (document_class IS NOT NULL)),
  CONSTRAINT position_codings_class_intensity CHECK (
    (document_class IS NULL AND intensity IS NULL)
    OR (document_class = 'supports' AND intensity IN (1, 2))
    OR (document_class = 'opposes' AND intensity IN (-2, -1))
    OR (document_class = 'explicit_neutral' AND intensity = 0)
    OR (document_class IN ('not_mentioned', 'ambiguous') AND intensity IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_position_codings_cell ON position_codings (entity_id, question_id);
CREATE INDEX IF NOT EXISTS idx_position_codings_run ON position_codings (run_id);
CREATE INDEX IF NOT EXISTS idx_position_codings_evaluator ON position_codings (evaluator_label, created_at);

-- Solo añadir: ninguna fila puede modificarse ni borrarse. (TRUNCATE queda bloqueado por el trigger de sentencia.)
CREATE OR REPLACE FUNCTION position_codings_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'position_codings es de solo añadir: % no permitido', TG_OP USING ERRCODE = 'restrict_violation';
END $$;

DROP TRIGGER IF EXISTS position_codings_no_update_delete ON position_codings;
CREATE TRIGGER position_codings_no_update_delete BEFORE UPDATE OR DELETE ON position_codings
  FOR EACH ROW EXECUTE FUNCTION position_codings_append_only();
DROP TRIGGER IF EXISTS position_codings_no_truncate ON position_codings;
CREATE TRIGGER position_codings_no_truncate BEFORE TRUNCATE ON position_codings
  FOR EACH STATEMENT EXECUTE FUNCTION position_codings_append_only();

COMMENT ON TABLE position_codings IS 'Codificaciones independientes por celda y evaluador (solo añadir). positions = resultado adjudicado.';
