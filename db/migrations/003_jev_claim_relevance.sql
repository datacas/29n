-- SPIKE-12: relevancia de cada cita (claim) de una posición según Jev. Informativa.
-- No modifica positions.evidence_jsonb; cualquier recorte de citas es una decisión humana aparte.

CREATE TABLE IF NOT EXISTS jev_claim_relevance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  run_id        uuid NOT NULL,
  claim_index   integer NOT NULL,          -- posición de la cita dentro de evidence_jsonb
  claim_sha1    text NOT NULL,             -- sha1 del literal_text, para detectar cambios posteriores
  p_relevant    numeric(5, 4),             -- null = Jev rechazó contestar
  model         text NOT NULL,
  input_tokens  integer,
  latency_ms    integer,
  created_at    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jev_claim_rel_position ON jev_claim_relevance (position_id, run_id);
