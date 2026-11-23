-- Texto explicativo neutral que se muestra bajo cada pregunta («¿Qué significa esto?»)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS context_text TEXT;
