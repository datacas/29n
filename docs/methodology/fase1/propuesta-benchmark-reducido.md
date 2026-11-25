# Propuesta de benchmark reducido de modelos codificadores, v2 (NO ejecutado)

Objetivo: elegir con datos qué modelos (de familias distintas, gratuitos primero) conviene usar como codificadores **sin que los errores de recuperación documental contaminen la elección**. No hay referencia humana independiente: las etiquetas de Codex del SPIKE-12 y las codificaciones o citas previas de Claude **no** son referencia dorada.

## Tres componentes, medidos por separado
| Componente | Qué mide | Cómo |
|---|---|---|
| **Recuperación** | ¿Llegan al modelo los pasajes que contienen la evidencia? | Diagnóstico determinista sin modelos (`retrieval_diag.mjs`), solo con preguntas de desarrollo |
| **Codificación** | ¿Interpreta bien la evidencia que ve? | **Modalidad A** (evidencia de referencia verificada presente) |
| **Extremo a extremo** | ¿Funciona el sistema real? | **Modalidad B** (recuperación automática) |

La recuperación no se imputa al codificador: en la modalidad A la evidencia candidata está garantizada; en la B, un fallo de recuperación se analiza aparte (la cita registrada no está entre los pasajes) y no cuenta contra el modelo.

## Modalidades
- **A — evidencia de referencia:** para celdas con cita registrada, el pasaje que la contiene (comprobado en el PDF) mezclado con K−1 distractores recuperados, en orden determinista (la referencia no va siempre primera). **Verificada** significa que la cita existe y es fiel al documento; no significa que sea la evidencia suficiente ni la única válida. Las celdas sin posición registrada no tienen referencia y no se puntúan en A.
- **B — recuperación automática:** los K pasajes del recuperador, igual para todos los modelos.

## Alcance de la ausencia de evidencia
La clase `not_mentioned` significa **ausencia en los pasajes dados**, no en el programa completo. Cada registro lleva `evidence_scope` (`reference_evidence_plus_distractors` o `passages_retrieved`) para no confundirlas. Confirmar la ausencia en el programa completo exige una pasada exhaustiva posterior (búsqueda léxica completa + revisión) y solo para las celdas que algún evaluador marque como `not_mentioned`.

## Recuperador
BM25 por párrafo con lematización ligera; consulta = pregunta + texto explicativo + vocabulario del ítem generado una vez por ítem con un modelo gratuito (prompt fijo, mismo para todos los ítems; sin reajustes por celda). Parámetros (K, variante) elegidos con las preguntas de desarrollo; el conjunto E no interviene. La recuperación densa o con reranking queda como alternativa a probar (necesita embeddings en OmniRoute o Jev para reordenar; ver el informe local).

## Conjuntos (script `benchmark_split.mjs`, semilla fija)
| Conjunto | Uso | Regla |
|---|---|---|
| **S** cribado | Descartar modelos | Preguntas de desarrollo |
| **D** ajuste | Ajustar prompt y manual | Preguntas de desarrollo, sin celdas de S |
| **E** evaluación final | Medir con prompt congelado y recuperador congelado | **Preguntas que S, D y el diagnóstico nunca ven**; sellado por huella SHA-256; se usa una vez; el diagnóstico de recuperación no lo toca |

## Métricas
Fidelidad documental (la cita del modelo existe en los pasajes) · clase · intensidad · concordancia entre modelos y, cuando exista el piloto, con humanos · detección de oposición, silencio y ambigüedad · cumplimiento del manual · salida estructurada · estabilidad · tasa de fallos técnicos (aparte, nunca como `not_mentioned`) · latencia, disponibilidad, cuota y coste. Para la recuperación: recall de página y de cita, tokens, precisión y ruido.

## Reglas
- Un modelo por **familia** en el panel de evaluadores independientes; se registra siempre el modelo real y el fallback.
- Umbrales de paso fijados **antes** de ver resultados; sin voto por mayoría.
- Presupuesto de cuota: los proveedores gratuitos limitan tokens por día. El arnés admite `--limit`, repeticiones y K reducidos; se lanza por tramos y se vigila el consumo antes de ampliar.
- Estrategia escalonada: gratuitos primero; mayor capacidad solo para discrepancias.
- El lanzamiento (`--confirm-authorized`) requiere autorización expresa.
