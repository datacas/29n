-- Procedencia de las evaluaciones y adjudicaciones (D26). Migración ADITIVA, solo BD local. No modifica position_codings (solo añadir) ni positions.
-- Motivo: las evaluaciones y adjudicaciones del piloto registradas como «Humano interno 1» las produjo un AGENTE DE IA que operaba esa cuenta (declaración del propio agente;
-- corroborada por los tiempos: 19 evaluaciones finalizadas en 54 s con justificaciones de ~535 caracteres). `position_codings.evaluator_kind = 'human'` no puede corregirse (solo añadir):
-- la procedencia se registra aparte y las métricas la usan para NO presentar esas filas como humanas.
CREATE TABLE IF NOT EXISTS eval_provenance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluator_id  uuid NOT NULL REFERENCES eval_evaluators(id) ON DELETE RESTRICT,
  campaign_id   uuid NOT NULL REFERENCES eval_campaigns(id) ON DELETE RESTRICT,
  scope         text NOT NULL CHECK (scope IN ('evaluation', 'adjudication', 'all')),
  provenance    text NOT NULL CHECK (provenance IN ('human_verified', 'ai_agent', 'unverified')),
  statement     text NOT NULL CHECK (length(btrim(statement)) > 0),
  evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS eval_provenance_append_only ON eval_provenance;
CREATE TRIGGER eval_provenance_append_only BEFORE UPDATE OR DELETE ON eval_provenance FOR EACH ROW EXECUTE FUNCTION eval_append_only();
CREATE INDEX IF NOT EXISTS idx_eval_provenance_lookup ON eval_provenance (evaluator_id, campaign_id, scope, recorded_at DESC);
COMMENT ON TABLE eval_provenance IS 'Procedencia declarada de las evaluaciones/adjudicaciones de un evaluador en una campaña. Última fila vigente por (evaluador, campaña, ámbito). Sin fila = unverified (no se cita como humana).';
