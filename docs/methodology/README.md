# Revisión metodológica de 29N — índice

Documentación del proceso de validez, fiabilidad y robustez de 29N iniciado a raíz del feedback metodológico externo (2026-11-25). El release 2.1.2 permanece congelado hasta el 29-nov-2026; todo el trabajo es en sombra (no modifica producción, banco de preguntas, scoring ni posiciones adjudicadas).

| Documento | Contenido |
|---|---|
| [`proceso-completo.md`](proceso-completo.md) | **Documento maestro**: origen, decisiones (con fecha), cada fase, desviaciones y errores corregidos, registro de ejecuciones, inventario técnico, límites de interpretación, seguridad y cómo reproducir/reanudar |
| [`flujo-de-trabajo.md`](flujo-de-trabajo.md) | Ramas, PR, CI y exclusión de despliegues de Vercel |
| [`clases-documentales.md`](clases-documentales.md) | Clases documentales, intensidad y estados de ejecución (aprobado) |
| [`trazabilidad.md`](trazabilidad.md) | Matriz de los 31 requisitos originales → 14 issues (#45–#58) y el issue de seguimiento #59 |
| [`coding-manual-v0.md`](coding-manual-v0.md) | Manual de codificación 0.1-benchmark que reciben los evaluadores |
| [`fase1/propuesta-benchmark-reducido.md`](fase1/propuesta-benchmark-reducido.md) | Diseño del benchmark (componentes, modalidades A/B, conjuntos S/D/E, recuperador, plan estadístico) |
| [`fase1/criterios-aceptacion-modalidad-A.md`](fase1/criterios-aceptacion-modalidad-A.md) | Criterios M (calidad) y O (operativos), congelados antes de obtener resultados |
| [`fase1/retriever-config-B.json`](fase1/retriever-config-B.json) | Configuración de recuperación congelada para la modalidad B (modelos con revisión y huellas) |
| [`fase1/evolucion-panel-modelos.md`](fase1/evolucion-panel-modelos.md) | Cómo cambió el panel de evaluadores y por qué |
| [`fase1/protocolo-auditoria-ciega.md`](fase1/protocolo-auditoria-ciega.md) | Protocolo de la segunda auditoría ciega de ítems (diseñada, no ejecutada) |
| [`fase1/verificacion-externa.md`](fase1/verificacion-externa.md) | Contraste de las métricas con librerías externas |
| [`fase2/propuesta-area-online-evaluacion.md`](fase2/propuesta-area-online-evaluacion.md) | Propuesta técnica del área online de evaluación humana ciega (OTP con Brevo, BD de evaluación aislada, alojamiento); **solo propuesta** |
| [`fase2/propuesta-interfaz-evaluacion-humana.md`](fase2/propuesta-interfaz-evaluacion-humana.md) | Propuesta anterior (paquetes HTML), sustituida |
| [`fase1/migracion-009.md`](fase1/migracion-009.md) | Tabla `position_codings` (solo añadir), prueba y recuperación |

## Qué es público y qué es local
- **Versionado (este directorio):** proceso, diseño, decisiones, código, configuraciones y pruebas.
- **Local y NO versionado** (`docs/methodology/local/`, excluido con `.git/info/exclude`): resultados por ítem y por partido, juicios de la auditoría de ítems, resultados de los benchmarks, caché de embeddings y traducciones, inventario de OmniRoute, entornos Python y claves. El informe completo se regenera con `node scripts/methodology/build_full_report.mjs`.
- Los detalles de hallazgos sobre el banco de preguntas y los partidos **no se publican** sin autorización expresa.
