# Criterios de aceptación de la modalidad A (fijados ANTES de ejecutar; no se modifican retrospectivamente)

Propuesta pendiente de aprobación expresa. Se aplican mecánicamente con `scripts/methodology/benchmark_analyze.mjs`.
Referencia provisional: las codificaciones registradas **no son referencia dorada**. La concordancia con ellas se informa como tal; no es exactitud validada.

## Criterios que pueden excluir a un modelo del paso a la modalidad B
Unidad: llamadas del modelo en el conjunto S, modalidad A, ambas repeticiones.
| # | Criterio | Umbral |
|---|---|---|
| T1 | Tasa de ejecuciones correctas (`execution_status = ok`) sobre llamadas intentadas | ≥ 90 % |
| T2 | Salida estructurada válida (clase e intensidad coherentes) sobre respuestas recibidas | ≥ 95 % |
| T3 | Modelo realmente ejecutado = modelo pedido (sin fallback) | ≥ 95 % de las llamadas |
| T4 | Latencia mediana / p95 | ≤ 30 s / ≤ 60 s |
| F1 | Fidelidad de la cita: cita existente en los pasajes (exacta o aproximada) cuando la clase no es `not_mentioned` | ≥ 90 % |
| E1 | Estabilidad: misma clase en las dos repeticiones (ambas correctas) | ≥ 85 % |
| P1 | Proveedor no detenido por el interruptor ni por agotar la cuota antes de completar el conjunto | sin parada |
Un modelo que incumpla cualquiera **no pasa a B**, salvo decisión expresa y motivada de la persona responsable, que se registra.

## Medidas informativas (no excluyen por sí solas)
- Concordancia con la referencia provisional, **por separado**: clase (porcentaje; alfa nominal; AC1) e intensidad (alfa ordinal, kappa ponderado cuadrático y lineal, AC2, exacta y ±1), esta última solo cuando coincide la clase.
- Discrepancias de **signo** (`supports` frente a `opposes`) con la referencia: si superan el 15 % de las celdas comparables, el modelo se marca para revisión humana de una muestra (no se excluye automáticamente: la referencia puede ser la equivocada).
- Distribución de clases por modelo, por estrato, idioma y partido; uso de `not_mentioned` (significa ausencia en los pasajes dados).
- Acuerdo entre modelos (alfa de Krippendorff nominal para la clase y ordinal para la intensidad, con IC por bootstrap; Gwet AC1/AC2) sin incluir a la referencia, y con ella como un evaluador más en un análisis aparte.
- Latencia, tokens y consumo de cuota.

## Reglas
- Diversidad: el panel que pase a B conserva al menos un modelo por proveedor y no cuenta como independientes modelos del mismo proveedor ni los que usen fallback.
- No se reajusta el prompt ni el manual con resultados de S. El ajuste se hace en D.
- Resultados en `docs/methodology/local/` (no versionados).
