# Criterios de aceptación de la modalidad A (APROBADOS como criterios preliminares de cribado; congelados antes de obtener resultados)

Aprobados el 2026-11-26 con las precisiones del responsable. No se modifican retrospectivamente ni se ajustan para favorecer a ningún modelo. Se aplican mecánicamente con `scripts/methodology/benchmark_analyze.mjs`.
La referencia son las codificaciones registradas: **provisional, no es referencia dorada**. La concordancia con ellas no es exactitud validada, y la concordancia entre modelos no es validación humana independiente.

## A. Calidad metodológica (decide si un modelo pasa a B)
Unidad: llamadas del modelo en S, modalidad A, ambas repeticiones, **excluidas las respuestas obtenidas por fallback** (se analizan aparte).
| # | Criterio | Umbral |
|---|---|---|
| M1 | Salida estructurada válida (clase e intensidad coherentes) sobre respuestas recibidas sin fallback | ≥ 95 % |
| M2 | Fidelidad de la cita: existente en los pasajes (exacta o aproximada) cuando la clase no es `not_mentioned` ni `ambiguous` | ≥ 90 % (criterio de **cribado de modelos**, no de publicación de posiciones) |
| M3 | Estabilidad: misma clase en las dos repeticiones correctas | ≥ 85 % |
Un modelo que incumpla M1, M2 o M3 **no pasa a B**, salvo decisión expresa y motivada de la persona responsable, que se registra.
La discrepancia de signo con la referencia (`supports` frente a `opposes`) superior al 15 % de las celdas comparables es **indicador de revisión humana de una muestra**, no de exclusión.

## B. Viabilidad operativa (informa del uso posible, no de la calidad)
| # | Indicador | Referencia |
|---|---|---|
| O1 | Ejecuciones técnicamente correctas sobre llamadas intentadas | ≥ 90 % |
| O2 | Respuestas del modelo pedido (sin fallback) | ≥ 95 % |
| O3 | Latencia mediana / p95 | ≤ 30 s / ≤ 60 s |
| O4 | Proveedor sin parada por interruptor ni por cuota | sin parada |
Incumplir un indicador operativo **no excluye** a un modelo de calidad metodológica suficiente: se clasifica como «válido con limitaciones» (p. ej. evaluador adicional o para resolver discrepancias, ya que 29N no codifica en tiempo real). El agotamiento de una cuota gratuita o la parada de un proveedor es una limitación operativa, no una señal de mala calidad.

## C. Fallbacks
Ninguna respuesta de un modelo distinto del pedido se atribuye al pedido: se excluye de sus métricas individuales y se informa por separado (cuántas y qué modelo respondió).

## D. Medidas informativas (no excluyen)
- Concordancia con la referencia provisional, **por separado**: clase (porcentaje; alfa nominal; AC1) e intensidad (alfa ordinal, kappa ponderado cuadrático y lineal, AC2, exacta y ±1), esta última solo cuando coincide la clase. `ambiguous` y `not_mentioned` nunca se convierten en puntuaciones ordinales.
- Acuerdo entre modelos (sin referencia): alfa de Krippendorff nominal (clase) y ordinal (intensidad), con IC por bootstrap; Gwet AC1/AC2.
- Distribución de clases por modelo, estrato, idioma y partido; uso de `not_mentioned` (ausencia en los pasajes dados).
- Latencia, tokens, consumo de cuota.

## E. Denominadores (se informan para cada métrica)
Llamadas intentadas → errores técnicos (por estado) → respuestas recibidas → respuestas con fallback (excluidas) → respuestas válidas del modelo pedido → evaluaciones comparables con la referencia → comparables para la intensidad (misma clase). Pares de repeticiones disponibles para la estabilidad.

## Reglas
- Diversidad: el panel que pase a B conserva al menos un modelo por proveedor; modelos del mismo proveedor o con fallback no cuentan como independientes.
- No se reajusta el prompt, el manual ni los criterios con resultados de S ni del piloto. El ajuste se hace en D.
- Resultados en `docs/methodology/local/` (no versionados).
