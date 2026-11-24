-- Neon (producción): contadores de las aportaciones anónimas a las estadísticas públicas.
-- Solo se guardan sumas, nunca una fila por persona: no se pueden reconstruir las respuestas de nadie.
-- Solo suma quien marca «Compartir de forma anónima» al terminar. Ejecutar una vez en la consola SQL de Neon.
--   kind = 'total'    key = ''          value = 0          → nº de aportaciones
--   kind = 'answer'   key = questionId  value = -2..2      → respuestas por pregunta (99 = «No sé» u omitida)
--   kind = 'affinity' key = entityId    value = 0..10      → afinidad por tramos de 10 % (10 = 100 %)
--   kind = 'top'      key = entityId    value = 0          → partido que sale primero
--   kind = 'mode'     key = quick|normal|deep|total  value = 0   → profundidad elegida por quien aporta
CREATE TABLE IF NOT EXISTS contribution_tallies (
  release_id  UUID NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('total', 'answer', 'affinity', 'top', 'mode')),
  key         TEXT NOT NULL,
  value       SMALLINT NOT NULL,
  n           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (release_id, kind, key, value)
);
