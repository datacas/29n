# SPIKE-12 — Jev como revisor editorial auxiliar

**Estado:** componente implementado y probado con mocks. **Benchmark real pendiente**: falta `TYPESAFE_API_KEY` y las etiquetas humanas. No hay resultados de Jev en este documento porque no se han ejecutado.

Principio: Jev **prioriza** la revisión humana; no aprueba, rechaza ni publica. Ningún código de este spike escribe en `positions.review_status`.

## Integración

- API directa de TypeSafe (no OpenRouter): `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`, modelo `jev-1.14.0` ([docs](https://docs.typesafe.ai/api), [modelos](https://docs.typesafe.ai/models)).
- Variables: `TYPESAFE_API_KEY` o `JEV_API_KEY` (una de las dos; la app ya usa `JEV_API_KEY`). Los scripts se ejecutan con `node --env-file=.env scripts/spike12/<script>.ts`, `JEV_MODEL` (por defecto `jev-1.14.0`), `TYPESAFE_BASE_URL` (opcional).
- Precio documentado: $0.042 por millón de tokens de entrada, salida gratis. La estimación de coste usa ese dato.
- Sin clave, los scripts se detienen con un mensaje (código de salida 2); no se simulan resultados.

## Qué se pregunta a Jev (una petición por posición)

| Pregunta | Tipo | Uso |
|---|---|---|
| `relevance` | choice: direct / tangential / unrelated | Pertinencia de la cita |
| `stance` | choice: supports / opposes / conditional / unclear | Apoyo u oposición |
| `evidence_sufficient` | noul (P de sí) | Suficiencia de evidencia |
| `contradiction` | noul | Citas contradictorias entre sí |
| `condition_material` | noul | Condiciones que cambian la lectura |
| `proposal_matches` | noul, solo modo `with_proposal` | Coherencia con la propuesta de Claude |

Dos modos: `with_proposal` (como pide el encargo: se envía la posición propuesta) e `independent` (sin ella). El benchmark corre ambos para medir si ver la propuesta de Claude **ancla** a Jev; esa es la razón de que la verificación "independiente" se compare con la anclada.

Abstención: Jev rechaza una pregunta (`refusal`) o la confianza de `stance` queda bajo 0,5. Si `contradiction` ≥ 0,5 la clase final es `contradictory`.

## Verificación determinista de citas

`app/lib/jev/quote.ts` comprueba, sin modelo, que cada cita literal aparece en el PDF (texto por página con `pdftotext`, ±1 página, tolerante a guiones y saltos de línea). Estados: `exact`, `fuzzy`, `not_found`, `no_source`. Mapa partido→PDF en `scripts/spike12/common.ts` (se puede sobrescribir con `docs/spike12/source_map.json`). Sumar se asocia a `Castellano.pdf` por coincidir en 95 páginas con su extracción; confírmalo.

En la muestra actual: 129 citas exactas, 3 aproximadas, 0 no encontradas.

## Triaje

> `needs_human_review` se eliminó (2026-11-19): marcaba 65 de 68 posiciones con evidencia y su AUC contra las decisiones humanas era 0,70. Los registros antiguos conservan su valor, pero ya no influye. Para recalcular el triaje guardado con las reglas actuales: `node scripts/spike12/retriage.ts` (no llama a Jev).

| Grupo | Condición |
|---|---|
| Contradictoria | Jev ve contradicción, polaridad opuesta a Claude (supports vs opposes) o una cita no está en el PDF |
| Dudosa | Desacuerdo menor, abstención, evidencia insuficiente, Jev pide revisión, cita sin PDF o solo aproximada |
| Alta confianza | Jev y Claude coinciden, evidencia suficiente, relevancia directa y citas verificadas |

Alta confianza **no** significa aprobada: solo permite una revisión humana simplificada.

## Flujo de ejecución

```bash
# 1. Muestra estratificada de 30 y plantilla de referencia (ya generada)
node scripts/spike12/sample.ts            # → docs/spike12/benchmark_sample.json

# 2. UNA PERSONA etiqueta en /admin/jev-labeling (pantalla ciega: no muestra la propuesta
#    de Claude ni la de Jev). Guarda human.stance + human.annotator en benchmark_sample.json.
#    stance: supports | opposes | conditional | unclear | contradictory

# 3. Benchmark: Jev (2 modos) y Claude contra las etiquetas humanas
TYPESAFE_API_KEY=... node scripts/spike12/benchmark.ts   # → benchmark_report.{json,md}

# 4. Solo si el benchmark lo justifica: shadow sobre las 75 pendientes
TYPESAFE_API_KEY=... node scripts/spike12/shadow.ts

# 5. Interfaz: /admin/jev-triage
```

La referencia **no** usa etiquetas de Claude: `benchmark.ts` se niega a ejecutar si falta alguna etiqueta humana. Las etiquetas de Claude se guardan en `claude_proposal` solo para compararlas.

## Muestra (semilla 12, 30 de 75)

Estratificada por caso: catalán, contradictorio, condicionado, ambiguo, claro; reparto por turnos entre partidos. Limitaciones conocidas del conjunto:

- Hay **un único** caso claro (agrees/disagrees sin matices) entre las 75; los casos claros están infrarrepresentados.
- El catalán proviene solo de ERC (9 posiciones pendientes), y ERC pesa más en la muestra por ello.
- Las 75 posiciones solo existen para 5 partidos; Vox y PSOE tienen pocos casos en algunos estratos.

## Métricas del benchmark

Precisión/recall/F1 por clase y macro, matriz de confusión, falsos apoyos, falsas oposiciones, inversiones de polaridad, tasa de abstención, detección de casos inciertos, latencia p50/p95, tokens y coste. Con n=30 los intervalos son amplios: no hay que presentar precisiones del 95 % ni del 99 % sin medirlas.

## Registros

Tabla `jev_shadow_reviews` (`db/migrations/002_jev_shadow_reviews.sql`): respuestas tipadas crudas con probabilidades, modelo pedido y devuelto, modo, clase de Claude y de Jev, triaje, estado de cada cita, tokens, latencia y coste. Separada de `positions`.

## Tests

`npx vitest run tests/jev` — 27 tests con `fetch` simulado: cliente (cabeceras, reintentos, 401, falta de clave), construcción de estado y preguntas (el modo `independent` no filtra la propuesta), abstención por rechazo, triaje, verificación de citas, métricas y muestra reproducible.

## Pendiente / decisiones para el equipo

1. Clave `TYPESAFE_API_KEY`.
2. Etiquetado humano de las 30 posiciones (estimación: 1–2 h).
3. Confirmar la formulación de las preguntas con una persona editora antes del benchmark (el resultado depende de ella).
4. Confirmar el mapa Sumar → `Castellano.pdf`.
5. Aprobaciones automáticas: fuera de alcance; el primer release mantiene aprobación humana final.

## Filtro de relevancia por cita (2026-11-19)

`scripts/spike12/claim_relevance.ts` pregunta a Jev, cita por cita, si responde directamente a la proposición (tabla `jev_claim_relevance`, informe `docs/spike12/claim_relevance_report.md`). Sobre las 5 posiciones que quedaban en revisión (137 citas, ~$0,002): Q021 PP/PSOE/Sumar 0 relevantes de 37/28/17; Q022 PSOE 5 de 32 y Sumar 2 de 23. No modifica `positions.evidence_jsonb`: recortar citas es decisión humana.

## Benchmark contra decisiones editoriales (2026-11-20)

`scripts/spike12/benchmark_decisions.ts`: Jev (modo `independent`) sobre la evidencia **actual** de las 93 posiciones piloto con evidencia y decisión (71 aprobadas, 22 rechazadas). Resultado en `docs/spike12/decisions_benchmark.json`. Coste ~$0,004.

Subconjunto **limpio** (evidencia del extractor original, n=60: 38 aprobadas, 22 rechazadas). Las 33 posiciones con evidencia recuperada se excluyen porque Jev ayudó a elegirlas (circular: 33/33 aprobadas, 0 marcas de Jev).

| Señal de Jev | AUC para anticipar rechazo | Marca | De ellas rechazadas | No marca | De ellas rechazadas |
|---|---|---|---|---|---|
| Relevancia no directa | 0,91 | 30 | 20 | 30 | 2 |
| Evidencia insuficiente (<0,5) | 0,92 | 29 | 19 | 31 | 3 |
| Postura "no claro" | 0,91 | 20 | 16 | 40 | 6 |
| Triaje "alta confianza" | — | 3 | 1 | 57 | 21 |

Limitaciones: un solo revisor; las decisiones se tomaron viendo el triaje de Jev (posible anclaje); n=22 rechazadas; mide "la evidencia responde a la pregunta", no la exactitud de la postura (no hay referencia de postura humana). El grupo "alta confianza" del triaje es demasiado estricto (3 de 60).

## Triaje v2 (2026-11-20)

Tras el benchmark contra decisiones editoriales se reescribió `app/lib/jev/triage.ts`: ya no usa la postura de Claude (AUC ≈ 0,52), ni la abstención de Jev, ni `needs_human_review`. Grupos:

| Grupo (BD) | Etiqueta en pantalla | Regla |
|---|---|---|
| `high_confidence` | Revisión rápida | Jev ve relevancia directa y evidencia suficiente (≥0,5); citas verificadas (exactas) |
| `doubtful` | Revisar con cuidado | Relevancia no directa, evidencia insuficiente, o citas no verificables/aproximadas |
| `contradictory` | Conflicto | Una cita no está en el PDF, o Jev ve contradicción (≥0,5) |

Validación sobre las decisiones (evidencia del extractor original, n=55): «Revisión rápida» 26 posiciones, 1 rechazada; «Revisar con cuidado» 29 posiciones, 16 rechazadas. Las 38 de evidencia recuperada con Jev son circulares y no cuentan. Dentro de cada grupo la pantalla ordena por menor suficiencia de evidencia. `node scripts/spike12/retriage.ts` recalcula los registros guardados sin llamar a Jev. Umbrales calibrados sobre n=55 y un solo revisor: pueden sobreajustarse.
