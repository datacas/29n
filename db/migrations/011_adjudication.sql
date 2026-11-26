-- Adjudicación en SOMBRA del piloto de evaluación humana (D23). Migración ADITIVA, solo BD local.
-- No modifica `positions`, el banco publicado, el scoring ni los releases: las adjudicaciones son nuevas decisiones de solo añadir, con causa(s) de la discrepancia.
-- Requiere 010. `eval_adjudications` está vacía en el momento de aplicarla (se amplía con columnas y restricciones).

-- Cola de adjudicación (celdas a revisar) con su expediente (dossier) construido en local: referencia, respuestas de IA, citas, páginas del programa.
CREATE TABLE IF NOT EXISTS eval_adjudication_items (
  cell_id    uuid PRIMARY KEY REFERENCES eval_cells(id) ON DELETE RESTRICT,
  priority   integer NOT NULL,
  reasons    text[] NOT NULL,
  dossier    jsonb NOT NULL,
  built_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eval_adjudications
  ADD COLUMN IF NOT EXISTS revision         integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS causes           text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS other_cause_text text,
  ADD COLUMN IF NOT EXISTS proposed_action  text,            -- propuesta SOBRE el banco; NO se aplica (queda en sombra)
  ADD COLUMN IF NOT EXISTS evidence         jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS own_coding_id    uuid REFERENCES position_codings(id),
  ADD COLUMN IF NOT EXISTS manual_version   text,
  ADD COLUMN IF NOT EXISTS cell_version     integer,
  ADD COLUMN IF NOT EXISTS applied          boolean NOT NULL DEFAULT false;   -- siempre false hasta autorización expresa

ALTER TABLE eval_adjudications DROP CONSTRAINT IF EXISTS eval_adjudications_causes_ck;
ALTER TABLE eval_adjudications ADD CONSTRAINT eval_adjudications_causes_ck CHECK (
  cardinality(causes) >= 1
  AND causes <@ ARRAY['retrieval_error','interpretation_error','intensity_error','insufficient_evidence','contradictory_evidence','ambiguous_question',
                      'manual_insufficient','omitted_position','unsupported_registered_position','reasonable_disagreement','other']::text[]
  AND ('other' <> ALL (causes) OR length(btrim(coalesce(other_cause_text, ''))) > 0));
ALTER TABLE eval_adjudications DROP CONSTRAINT IF EXISTS eval_adjudications_action_ck;
ALTER TABLE eval_adjudications ADD CONSTRAINT eval_adjudications_action_ck CHECK (
  proposed_action IS NULL OR proposed_action IN ('confirm_registered', 'correct_registered', 'remove_registered', 'add_position', 'no_change'));
ALTER TABLE eval_adjudications DROP CONSTRAINT IF EXISTS eval_adjudications_class_intensity_ck;
ALTER TABLE eval_adjudications ADD CONSTRAINT eval_adjudications_class_intensity_ck CHECK (
  (document_class IS NULL AND intensity IS NULL)
  OR (document_class = 'supports' AND intensity IN (1, 2))
  OR (document_class = 'opposes' AND intensity IN (-2, -1))
  OR (document_class = 'explicit_neutral' AND intensity = 0)
  OR (document_class IN ('not_mentioned', 'ambiguous') AND intensity IS NULL));
ALTER TABLE eval_adjudications DROP CONSTRAINT IF EXISTS eval_adjudications_applied_ck;
ALTER TABLE eval_adjudications ADD CONSTRAINT eval_adjudications_applied_ck CHECK (applied = false);   -- aplicar al banco requiere autorización expresa y una migración posterior
ALTER TABLE eval_adjudications DROP CONSTRAINT IF EXISTS eval_adjudications_rationale_ck;
ALTER TABLE eval_adjudications ADD CONSTRAINT eval_adjudications_rationale_ck CHECK (length(btrim(rationale)) > 0);
CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_adjudications_rev ON eval_adjudications (cell_id, adjudicator_id, revision);

-- La revisión debe ser consecutiva (1, 2, 3…): una nueva decisión sustituye a la vigente sin borrar la anterior.
CREATE OR REPLACE FUNCTION eval_adjudication_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last integer;
BEGIN
  SELECT max(revision) INTO last FROM eval_adjudications WHERE cell_id = NEW.cell_id AND adjudicator_id = NEW.adjudicator_id;
  IF NEW.revision <> coalesce(last, 0) + 1 THEN
    RAISE EXCEPTION 'eval_adjudications: la revisión debe ser % (recibida %)', coalesce(last, 0) + 1, NEW.revision USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eval_adjudication_revision ON eval_adjudications;
CREATE TRIGGER eval_adjudication_revision BEFORE INSERT ON eval_adjudications FOR EACH ROW EXECUTE FUNCTION eval_adjudication_revision();

COMMENT ON TABLE eval_adjudications IS 'Decisiones de adjudicación (solo añadir, en sombra: applied siempre false). Varias causas; revisiones consecutivas.';
COMMENT ON TABLE eval_adjudication_items IS 'Celdas a adjudicar y su expediente local (referencia, respuestas de IA, citas, páginas del programa).';
