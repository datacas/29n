-- Evaluación humana ciega en el panel administrativo LOCAL (piloto de la revisión metodológica; D21).
-- Migración ADITIVA y solo para la BD local (no se aplica en Neon ni en producción). No toca `positions`, el banco de preguntas ni el scoring.
-- Recuperación: ver docs/methodology/fase2/migracion-010.md.
--
-- Principios
--  * Las evaluaciones FINALIZADAS viven en `position_codings` (solo añadir). Los borradores, en `eval_drafts` (mutables hasta finalizar).
--  * La clase documental, el estado técnico de la ejecución y la «insuficiencia de contexto» son conceptos distintos: la insuficiencia de contexto es una
--    conclusión metodológica válida del evaluador (columna propia), NO un fallo técnico (`execution_status` sigue siendo `ok`).
--  * Las instantáneas de cada celda (pregunta, contexto, pasajes) son inmutables y versionadas: añadir contexto crea una versión NUEVA.
--  * Preparado para evaluadores externos futuros (afiliación, correo opcional) sin implementar su acceso.

-- ---------------------------------------------------------------------------------------------------------------------
-- position_codings: columnas aditivas y restricción actualizada
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE position_codings
  ADD COLUMN IF NOT EXISTS insufficient_context boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_id          uuid,
  ADD COLUMN IF NOT EXISTS evaluator_id         uuid,
  ADD COLUMN IF NOT EXISTS revision             integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cell_version         integer;

-- Con ejecución correcta hace falta una clase O la conclusión de contexto insuficiente; con fallo técnico no hay clase ni conclusión.
ALTER TABLE position_codings DROP CONSTRAINT IF EXISTS position_codings_status_class;
ALTER TABLE position_codings ADD CONSTRAINT position_codings_status_class CHECK (
  CASE WHEN execution_status = 'ok' THEN (document_class IS NOT NULL OR insufficient_context)
       ELSE (document_class IS NULL AND NOT insufficient_context) END);

-- Una evaluación finalizada por (campaña, evaluador, celda, revisión).
CREATE UNIQUE INDEX IF NOT EXISTS uq_position_codings_eval
  ON position_codings (campaign_id, evaluator_id, question_id, entity_id, revision) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_position_codings_evaluator ON position_codings (evaluator_id, question_id, entity_id) WHERE evaluator_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- Funciones de protección
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eval_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% es de solo añadir: % no permitido', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Evaluadores, campañas, celdas y versiones
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eval_evaluators (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL UNIQUE,                       -- p. ej. «Humano interno 1»
  affiliation   text NOT NULL CHECK (affiliation IN ('internal', 'external')),
  active        boolean NOT NULL DEFAULT true,
  email         text,                                       -- opcional; reservado para evaluadores externos futuros
  credential_id uuid REFERENCES admin_credentials(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_evaluators_credential ON eval_evaluators (credential_id) WHERE credential_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS eval_campaigns (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  kind                 text NOT NULL DEFAULT 'pilot' CHECK (kind IN ('pilot', 'repeatability', 'main')),
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  manual_version       text NOT NULL,
  manual_text          text NOT NULL,                       -- copia inmutable del manual de la campaña
  selection_method     text NOT NULL,                       -- cómo se eligieron las celdas (se imprime en los informes)
  selection_bias_note  text NOT NULL,                       -- sesgo de selección documentado
  source_campaign_id   uuid REFERENCES eval_campaigns(id),  -- campañas de repetibilidad
  created_at           timestamptz NOT NULL DEFAULT now(),
  closed_at            timestamptz
);

CREATE TABLE IF NOT EXISTS eval_cells (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL REFERENCES eval_campaigns(id) ON DELETE RESTRICT,
  ord            integer NOT NULL,                          -- orden de presentación (aleatorio y fijo por campaña)
  question_id    uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  entity_id      uuid NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  blind_label    text NOT NULL,                             -- «Partido A…»
  party_name     text NOT NULL,                             -- SOLO administración: ninguna consulta de evaluación la lee
  extra_context  jsonb NOT NULL DEFAULT '[]'::jsonb,        -- contexto adicional disponible bajo petición (páginas completas)
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, ord),
  UNIQUE (campaign_id, question_id, entity_id)
);

CREATE TABLE IF NOT EXISTS eval_cell_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id     uuid NOT NULL REFERENCES eval_cells(id) ON DELETE RESTRICT,
  version     integer NOT NULL,
  snapshot    jsonb NOT NULL,                               -- {item, context, passages:[{page,text}]} (sin partido, referencia ni respuestas de IA)
  sha256      text NOT NULL,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cell_id, version)
);
DROP TRIGGER IF EXISTS eval_cell_versions_append_only ON eval_cell_versions;
CREATE TRIGGER eval_cell_versions_append_only BEFORE UPDATE OR DELETE ON eval_cell_versions FOR EACH ROW EXECUTE FUNCTION eval_append_only();

CREATE TABLE IF NOT EXISTS eval_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id       uuid NOT NULL REFERENCES eval_cells(id) ON DELETE RESTRICT,
  evaluator_id  uuid NOT NULL REFERENCES eval_evaluators(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cell_id, evaluator_id)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Borradores (mutables hasta finalizar) y peticiones de contexto
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eval_drafts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id               uuid NOT NULL REFERENCES eval_cells(id) ON DELETE RESTRICT,
  evaluator_id          uuid NOT NULL REFERENCES eval_evaluators(id) ON DELETE RESTRICT,
  cell_version          integer NOT NULL,                   -- versión de la celda que el evaluador estaba viendo
  version               integer NOT NULL DEFAULT 1,         -- concurrencia optimista
  document_class        text CHECK (document_class IN ('supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous')),  -- SIN valor por defecto
  intensity             smallint CHECK (intensity BETWEEN -2 AND 2),                                                              -- SIN valor por defecto
  selected_evidence     jsonb NOT NULL DEFAULT '[]'::jsonb, -- índices de pasaje de la versión de celda vista
  rationale             text NOT NULL DEFAULT '',
  insufficient_context  boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  finalized_at          timestamptz,
  coding_id             uuid REFERENCES position_codings(id),
  UNIQUE (cell_id, evaluator_id)
);

CREATE OR REPLACE FUNCTION eval_drafts_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'eval_drafts: no se pueden borrar borradores' USING ERRCODE = 'restrict_violation'; END IF;
  IF OLD.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'eval_drafts: la evaluación ya está finalizada y no se puede modificar' USING ERRCODE = 'restrict_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eval_drafts_guard ON eval_drafts;
CREATE TRIGGER eval_drafts_guard BEFORE UPDATE OR DELETE ON eval_drafts FOR EACH ROW EXECUTE FUNCTION eval_drafts_guard();

CREATE TABLE IF NOT EXISTS eval_context_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id           uuid NOT NULL REFERENCES eval_cells(id) ON DELETE RESTRICT,
  evaluator_id      uuid NOT NULL REFERENCES eval_evaluators(id) ON DELETE RESTRICT,
  note              text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  resolved_version  integer
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Adjudicación (solo añadir) y auditoría (solo añadir)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eval_adjudications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id          uuid NOT NULL REFERENCES eval_cells(id) ON DELETE RESTRICT,
  adjudicator_id   uuid NOT NULL REFERENCES eval_evaluators(id) ON DELETE RESTRICT,
  document_class   text CHECK (document_class IN ('supports', 'opposes', 'explicit_neutral', 'not_mentioned', 'ambiguous')),
  intensity        smallint CHECK (intensity BETWEEN -2 AND 2),
  rationale        text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Puerta en la propia BD: no se adjudica una celda sin haber FINALIZADO antes la evaluación propia de esa celda.
CREATE OR REPLACE FUNCTION eval_adjudication_gate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM eval_drafts d WHERE d.cell_id = NEW.cell_id AND d.evaluator_id = NEW.adjudicator_id AND d.finalized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'eval_adjudications: hay que finalizar la evaluación propia de la celda antes de adjudicar' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eval_adjudication_gate ON eval_adjudications;
CREATE TRIGGER eval_adjudication_gate BEFORE INSERT ON eval_adjudications FOR EACH ROW EXECUTE FUNCTION eval_adjudication_gate();
DROP TRIGGER IF EXISTS eval_adjudications_append_only ON eval_adjudications;
CREATE TRIGGER eval_adjudications_append_only BEFORE UPDATE OR DELETE ON eval_adjudications FOR EACH ROW EXECUTE FUNCTION eval_append_only();

CREATE TABLE IF NOT EXISTS eval_audit (
  id           bigserial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  evaluator_id uuid,
  action       text NOT NULL,
  campaign_id  uuid,
  cell_id      uuid,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb
);
DROP TRIGGER IF EXISTS eval_audit_append_only ON eval_audit;
CREATE TRIGGER eval_audit_append_only BEFORE UPDATE OR DELETE ON eval_audit FOR EACH ROW EXECUTE FUNCTION eval_append_only();

CREATE INDEX IF NOT EXISTS idx_eval_cells_campaign ON eval_cells (campaign_id, ord);
CREATE INDEX IF NOT EXISTS idx_eval_drafts_evaluator ON eval_drafts (evaluator_id, cell_id);
CREATE INDEX IF NOT EXISTS idx_eval_audit_cell ON eval_audit (cell_id, at);

COMMENT ON TABLE eval_cell_versions IS 'Instantáneas inmutables y versionadas de las celdas ciegas.';
COMMENT ON TABLE eval_drafts IS 'Borradores de evaluación humana (mutables hasta finalizar). Las finalizadas están en position_codings.';
