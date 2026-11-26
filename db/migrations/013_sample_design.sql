-- Diseño de la muestra de la campaña humana de ~150 celdas, comprobaciones de ausencia y autoría por registro (D30). Migración ADITIVA, solo BD local.
-- No modifica positions, el banco, el scoring ni los releases. Requiere 010–012.

-- Diseño muestral por celda (inmutable): ningún endpoint de evaluación lo lee (ceguera: el evaluador no sabe qué celdas son representativas o dirigidas, ni su estrato ni su peso).
CREATE TABLE IF NOT EXISTS eval_sample_design (
  cell_id          uuid PRIMARY KEY REFERENCES eval_cells(id) ON DELETE RESTRICT,
  sample           text NOT NULL CHECK (sample IN ('R', 'T')),         -- R representativa; T dirigida (se analizan por separado)
  tier             text NOT NULL,                                      -- R: estrato; T: T1_candidata_omision | T2_resto_S
  stratum          text NOT NULL,
  stratum_size     integer,                                            -- N_h (solo R)
  stratum_sampled  integer,                                            -- n_h (solo R)
  inclusion_prob   double precision CHECK (inclusion_prob IS NULL OR (inclusion_prob > 0 AND inclusion_prob <= 1)),   -- π_h = n_h/N_h (solo R)
  weight           double precision CHECK (weight IS NULL OR weight >= 1),                                           -- 1/π_h (solo R)
  replaces_cell    text,                                               -- identificador de la celda sustituida (solo por invalidez técnica; registrado)
  repeat_selected  boolean NOT NULL DEFAULT false,                     -- preseleccionada para repetibilidad (≥ 7 días después)
  seed             bigint,
  design_sha256    text NOT NULL,                                      -- huella del diseño completo (marco, semillas, reglas)
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((sample = 'R' AND inclusion_prob IS NOT NULL AND weight IS NOT NULL AND stratum_size IS NOT NULL AND stratum_sampled IS NOT NULL) OR (sample = 'T' AND inclusion_prob IS NULL AND weight IS NULL))
);
DROP TRIGGER IF EXISTS eval_sample_design_append_only ON eval_sample_design;
CREATE TRIGGER eval_sample_design_append_only BEFORE UPDATE OR DELETE ON eval_sample_design FOR EACH ROW EXECUTE FUNCTION eval_append_only();

-- Estados diferenciados de «ausencia»: (a) ausencia de mención en los PASAJES recuperados = clase `not_mentioned` de la evaluación; (b) contexto insuficiente = `insufficient_context`;
-- (c) ausencia CONFIRMADA en el programa completo = esta tabla (comprobación posterior, no en la evaluación ciega).
CREATE TABLE IF NOT EXISTS eval_absence_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id       uuid NOT NULL REFERENCES eval_cells(id) ON DELETE RESTRICT,
  checked_by    uuid NOT NULL REFERENCES eval_evaluators(id) ON DELETE RESTRICT,
  scope         text NOT NULL CHECK (scope IN ('retrieved_passages', 'full_program')),
  result        text NOT NULL CHECK (result IN ('absent_confirmed', 'present_found', 'not_checkable')),
  search_terms  text[] NOT NULL DEFAULT '{}',
  pages_reviewed integer[] NOT NULL DEFAULT '{}',
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (result <> 'absent_confirmed' OR (scope = 'full_program' AND cardinality(search_terms) >= 1))   -- confirmar ausencia exige haber buscado en el programa completo y con términos
);
DROP TRIGGER IF EXISTS eval_absence_checks_append_only ON eval_absence_checks;
CREATE TRIGGER eval_absence_checks_append_only BEFORE UPDATE OR DELETE ON eval_absence_checks FOR EACH ROW EXECUTE FUNCTION eval_append_only();
CREATE INDEX IF NOT EXISTS idx_eval_absence_cell ON eval_absence_checks (cell_id, created_at);

-- Autoría material vs responsable que autoriza, por registro (los registros originales son inmutables: la autoría se anota aparte, solo añadir; vale la última anotación).
CREATE TABLE IF NOT EXISTS eval_authorship (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_table  text NOT NULL CHECK (record_table IN ('position_codings', 'eval_adjudications')),
  record_id     uuid NOT NULL,
  author_kind   text NOT NULL CHECK (author_kind IN ('human', 'human_with_agent_support', 'ai_agent', 'unverified')),   -- quién la produjo materialmente
  author_label  text NOT NULL,
  authorized_by text,                                                                                                  -- quién la autoriza/responde de ella (puede ser distinto del autor)
  note          text NOT NULL DEFAULT '',
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS eval_authorship_append_only ON eval_authorship;
CREATE TRIGGER eval_authorship_append_only BEFORE UPDATE OR DELETE ON eval_authorship FOR EACH ROW EXECUTE FUNCTION eval_append_only();
CREATE INDEX IF NOT EXISTS idx_eval_authorship_record ON eval_authorship (record_table, record_id, recorded_at DESC);

COMMENT ON TABLE eval_sample_design IS 'Diseño muestral inmutable por celda (muestra R/T, estrato, π, peso, semilla). No lo lee ninguna API de evaluación (ceguera).';
COMMENT ON TABLE eval_absence_checks IS 'Comprobaciones de ausencia: separa «no mencionado en los pasajes» de «ausencia confirmada en el programa completo».';
COMMENT ON TABLE eval_authorship IS 'Autoría material y autorización por registro. Un agente que registra bajo autorización NO aparece como evaluación humana personal.';
