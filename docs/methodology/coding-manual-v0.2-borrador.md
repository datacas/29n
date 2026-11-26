# Manual de codificación v0.2 — BORRADOR (SUPERADO por `coding-manual-v0.2.md`; se conserva como histórico de la recodificación de 8 celdas)

> **BORRADOR NO RATIFICADO.** Basado en v0.1-benchmark con las aclaraciones de `docs/methodology/fase2/propuesta-manual-v0.2.md`. Las decisiones que lo sustentan proceden de mensajes de autoría no verificada (D26) y **están pendientes de ratificación por la persona responsable**. No es el manual vigente: v0.1 sigue siendo el de los benchmarks.

Versión **0.2-borrador**. Borrador para comparar modelos; no es el manual definitivo por ítem (#46). Lo reciben todos los evaluadores, humanos y modelos, sin ver las respuestas de los demás.

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


## Aclaraciones v0.2 (borrador)
**Medida cercana (±1).** Solo si tiene el **mismo objeto** que la proposición, la **misma dirección** con el **mismo mecanismo o un instrumento sustituto equivalente**, y es una **medida concreta** (no un principio, una orientación genérica ni una reclamación competencial). Si solo cambia el instrumento (p. ej. subvención directa frente a deducción fiscal), la clase es `not_mentioned`; puedes citarlo como contexto en la justificación, nunca como posición.

**Cláusulas que presuponen la medida** («si hay aumentos, que no recorten servicios»): no cuentan por sí solas como apoyo ni oposición ni como cita de la posición. Decide por los **compromisos propios** del programa sobre el objeto; si no hay otros → `not_mentioned`; si hay señales contrarias y a favor → `ambiguous`. Anota la cláusula en la justificación con la etiqueta `presuposicional`.

**Compromiso propio (precisión, borrador).** Un pasaje solo cuenta como compromiso propio si (1) declara la dirección (más, menos o mantener) de **la misma magnitud** por la que pregunta la proposición, **en el mismo nivel de gobierno**, y (2) **no es compatible con ambos sentidos** de la proposición. Mejorar la eficiencia, reducir duplicidades, auditar o cambiar la composición de un gasto no fijan por sí solos si el total sube o baja; tampoco las secciones de orientación general (son contexto). Si ningún pasaje cumple (1) y (2) → `not_mentioned`; si hay señales contrarias que sí las cumplen → `ambiguous`.

**Qué recorta el alcance (+2 frente a +1).** Recortan: un criterio de reparto que restringe **a quién llega** la medida (p. ej. nacionalidad) o que coincide con **el lado contrario que plantea la propia pregunta** (p. ej. ligar las ayudas al mérito si la pregunta lo presenta como la alternativa); una condición **específica** de esa medida que puede impedirla. **No recortan:** otros criterios de asignación (tramos, procedimiento), plazos o calendarios firmes, y una **regla fiscal o de financiación general** aplicable a medidas del mismo tipo (salvo que vaya ligada a esa medida en concreto o la haga explícitamente opcional: «si la economía lo permite»). La vaguedad (sin cuantía, objetivo ni plazo) mantiene ±1 por vaguedad.

**Cita.** Literal, copiada de **un único pasaje**, con su página, y que **por sí misma sostenga la clase** (que se refiera a la medida, no solo al tema). Una garantía o cláusula presuposicional no vale como cita de la posición.

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
