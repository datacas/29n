# Manual de codificación v0 (benchmark reducido)

Versión **0.1-benchmark**. Borrador para comparar modelos; no es el manual definitivo por ítem (#46). Lo reciben todos los evaluadores, humanos y modelos, sin ver las respuestas de los demás.

## Tarea
Se te da una **pregunta** de un cuestionario político, un texto explicativo y unos **pasajes del programa electoral de un partido** (con su página). Decide qué dice el programa sobre la proposición de la pregunta, tal y como está redactada.

## Clase documental (obligatoria)
| Clase | Cuándo |
|---|---|
| `supports` | El programa apoya la medida de la pregunta. |
| `opposes` | El programa rechaza la medida o propone claramente lo contrario. |
| `explicit_neutral` | El programa declara de forma explícita una posición intermedia o dice no tomar partido. Es raro. |
| `not_mentioned` | En los pasajes dados no hay nada que responda a la pregunta. El silencio **no** es neutralidad ni oposición. |
| `ambiguous` | Hay señales contradictorias, o una condición cambia la lectura, y no puedes decidir. |

No infieras posiciones por la ideología del partido, ni por lo que defiendan partidos parecidos, ni por la extensión del programa. Si los pasajes no responden a la pregunta, es `not_mentioned` aunque el tema se nombre de pasada.

## Intensidad (solo según la clase)
- `supports`: **+2** si hay compromiso claro con la medida de la pregunta, sin salvedades que recorten su alcance; **+1** si es parcial, vago, condicionado, un principio sin medida o una medida cercana.
- `opposes`: **−2** o **−1** con el mismo criterio, en sentido contrario.
- `explicit_neutral`: `0`.
- `not_mentioned` y `ambiguous`: `null`.
Criterios completos de ±1/±2 en `docs/guia-intensidad.md`.

## Evidencia
Cita **literal** (copiada de un pasaje) y su página. Si la clase es `not_mentioned`, la cita es `null`.

## Salida
Solo un objeto JSON, sin texto adicional ni marcas de código:
```json
{"document_class":"supports","intensity":2,"quote":"cita literal","page":12,"rationale":"máx. 40 palabras"}
```

## Importante
- Tu respuesta se registra con tu identidad de evaluador; no se resuelven discrepancias por mayoría.
- Los fallos técnicos (error, tiempo, documento no disponible) los registra el sistema aparte: nunca los codifiques como `not_mentioned`.
