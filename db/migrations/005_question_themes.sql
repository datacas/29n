-- v2: cada pregunta pertenece a un tema de la taxonomía (docs/taxonomy/themes.json).
-- Las preguntas regionales solo se muestran si el votante elige alguno de esos partidos.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS theme_code text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS regional_parties text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_questions_theme ON questions (theme_code);
