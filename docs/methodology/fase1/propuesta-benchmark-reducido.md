# Propuesta de benchmark reducido de modelos codificadores (NO ejecutado)

Objetivo: elegir con datos qué modelos (de familias distintas, gratuitos primero) merece la pena usar como codificadores, **antes** de cualquier recodificación masiva. No hay todavía referencia humana independiente: las etiquetas de Codex del SPIKE-12 no cuentan como tal, y las clases de Claude tampoco.

## Conjuntos (script `scripts/methodology/benchmark_split.mjs`, semilla fija)
| Conjunto | Celdas | Uso | Regla |
|---|---|---|---|
| **S** cribado | 40 | Descartar modelos que no sirven | Preguntas de desarrollo |
| **D** ajuste | ~60 | Ajustar prompt y manual de los modelos que pasan el cribado | Preguntas de desarrollo, sin celdas de S |
| **E** evaluación final | ~146 | Medir los modelos con prompt congelado; candidato al piloto humano | **Preguntas que S y D nunca ven**; sellado con huella SHA-256; se usa una vez |

La separación es **por pregunta**, no por celda, para que ajustar un prompt sobre un ítem no contamine la evaluación. Estratos: positiva ±2, positiva ±1, negativa, neutral/condicionada, ambigua/no comparable y sin fila (silencio). Las preguntas regionales quedan fuera.

## Fases
1. **Sondeo técnico** (≈3 llamadas por modelo; requiere la clave local de OmniRoute): ventana de contexto real, salida estructurada válida, límites de tasa, latencia, y si hay *fallback* (campo del modelo que responde).
2. **Cribado en S** (2 repeticiones por modelo): descarta por métricas que **no necesitan referencia humana**: validez del JSON, fidelidad de la cita (comprobación determinista contra el PDF), tasa de rechazo/fallo por estado técnico, estabilidad entre repeticiones, cumplimiento del manual, latencia, disponibilidad y coste.
3. **Ajuste en D**: ajustar prompt/manual con los supervivientes; congelar versión.
4. **Evaluación en E** con prompt congelado: clasificación, intensidad, concordancia entre modelos (alfa ordinal con IC, AC2, kappa ponderado) y **frente a humanos cuando exista el piloto**. Los humanos nunca ven las salidas de los modelos.

## Métricas
Fidelidad documental · clase (apoya/se opone/neutral/no menciona/ambigua) · intensidad · concordancia entre modelos y con humanos · detección de oposición explícita, de silencio y de ambigüedad · justificación de la intensidad · estabilidad entre ejecuciones · cumplimiento del manual · calidad de la salida estructurada · tasa de fallos técnicos (informada aparte, nunca como `not_mentioned`) · latencia, disponibilidad y coste.

## Reglas
- Un modelo por **familia** en el panel de evaluadores independientes; modelos de la misma familia no cuentan como evidencias distintas.
- Se registra siempre el modelo que de verdad respondió (`model_actual`) y se deshabilita o detecta el *fallback*.
- Umbrales de paso fijados **antes** de ver resultados (propuesta: JSON válido ≥95 %, cita exacta ≥95 %, estabilidad de clase entre repeticiones ≥85 %); son un punto de partida, no un resultado.
- Sin voto por mayoría para resolver discrepancias.
- Estrategia escalonada: modelos gratuitos primero; modelos de mayor coste solo para discrepancias, casos complejos y verificaciones.
- El número final de evaluadores se decide con estos resultados.

## Coste y trabajo
Unas 80 llamadas por modelo en el cribado. Con ~15 candidatos, ~1.200 llamadas en modelos gratuitos o casi gratuitos; coste estimado ≈0 salvo los límites de tasa. Sin trabajo humano hasta la fase E, salvo ajustar el manual.
