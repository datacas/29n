# Seguridad

La web pública solo sirve ficheros estáticos (la encuesta, los programas y sus datos) y recibe estadísticas anónimas de uso
(`POST /api/stats/event`: modo, número de partidos y de preguntas, tipo de dispositivo). No guarda IP, respuestas ni resultados.
El panel de administración y todas las demás rutas de API no forman parte del build público (devuelven 404).

Si encuentras un problema de seguridad o un dato personal publicado por error, **no abras un issue público**:
usa «Report a vulnerability» en la pestaña Security del repositorio.
