# Manual de codificación v0.2 — cambios respecto a v0.1, motivos y casos de regresión

Fecha: 2026-11-26. Manual: `docs/methodology/coding-manual-v0.2.md` (congelado; huellas en `docs/methodology/manual-hashes.json`, verificadas por CI). Aprobado por la persona responsable el 2026-11-25/26 como manual vigente **para la campaña de evaluación humana de ~150 celdas** (mensaje comunicado por la persona responsable). **v0.1-benchmark sigue siendo el manual de los benchmarks A y B y de las evaluaciones históricas; sus métricas NO se recalculan con los criterios de v0.2. Cada evaluación conserva el manual con el que se hizo** (`position_codings.manual_version`).

## Versionado
| Versión | Aplicación |
|---|---|
| 0.1-benchmark | Benchmarks A y B y evaluaciones históricas (incluido el piloto de 19 celdas) |
| 0.2-borrador | Recodificación de 8 celdas por una persona (histórico) |
| 0.2 | Campaña de ~150 celdas |
| Futuras | Solo con cambios justificados, documentados y con evaluación de impacto; nunca se edita una versión congelada |

## Cambios y motivos
| # | Cambio | Motivo (qué falló) |
|---|---|---|
| 1 | **Medida cercana** (±1): mismo objeto, misma dirección con el mismo mecanismo o un sustituto equivalente, y medida concreta. Solo cambia el instrumento → `not_mentioned` (opción A) | v0.1 la mencionaba sin definirla: se estiraba hasta orientaciones competenciales y medidas de otro instrumento |
| 2 | **Cláusulas presuposicionales** no cuentan por sí solas; etiqueta `presuposicional` como señal de diagnóstico | Una garantía («si hay aumentos, que no recorten…») se leía como apoyo o como rechazo |
| 2b | **Compromiso propio** (decisión 6, opción A): misma magnitud y mismo nivel de gobierno + prueba de compatibilidad con ambos sentidos | «Compromisos propios» admitía lecturas de orientación general frente a compromiso sobre la magnitud concreta |
| 3 | **Qué recorta el alcance** (+2 frente a +1): criterio de reparto acotado (a quién llega; lado contrario de la pregunta) y condiciones específicas de la medida; no recortan regla fiscal general, plazos firmes ni otros criterios de asignación | v0.1 no distinguía condiciones que recortan el alcance |
| 4 | **Cita**: literal, de un solo pasaje, con página y que por sí misma sostenga la clase; comprobación automática por niveles (`citation_check.mjs`); «sostiene la clase» requiere revisión humana | Citas recompuestas pasaban la comprobación de bolsa de palabras; una cita literal puede no sostener la justificación |
| 5 | **Sin coincidencia léxica obligatoria**: vale una implicación inequívoca sin premisas ideológicas ni interpretaciones subjetivas | Evitar exigir palabras idénticas sin permitir inferencias |
| 6 | **Contradicción no es neutralidad**: señales contradictorias → `ambiguous`; `explicit_neutral` solo si lo declara el programa | Evitar confundir contradicción documental con posición intermedia |
| 7 | **Simetría**: mismos criterios para todos los partidos, ideologías y dimensiones | Evitar sesgo de aplicación |

## Casos de regresión
**Sintéticos y permanentes** (en el propio manual, proposición «España debe reducir el gasto militar»): reducir/incrementar/mantener/rechazar reducción del presupuesto español → clase por dirección; auditar, eliminar duplicidades a nivel europeo o promover cultura de paz → `not_mentioned`.

**Reales y permanentes (locales):** `docs/methodology/local/casos_regresion_manual.json` y `node scripts/methodology/manual_regression.mjs`. La **celda 12 del piloto** (medida de eficiencia a nivel europeo + garantía presuposicional; `not_mentioned` con v0.2, antes −1) es la **prueba metodológica permanente** de la regla 2, junto con las celdas 6, 15, 3, 7, 2 y 16. Si una versión futura cambia alguno de estos resultados, es un cambio de criterio que exige justificación y evaluación de impacto.

## Revisión de adjudicaciones previas con la regla 2 (local, sin modelos)
De las adjudicaciones del piloto solo **la de la celda 12** cambia con la regla 2 (de −1 a `not_mentioned`): se registró una **revisión nueva** (la anterior se conserva) por autorización expresa de la persona responsable. Las demás son coherentes con v0.2. No se modifica `positions` ni ninguna posición publicada.

## Procedencia y límites
Las decisiones se comunicaron mediante mensajes de la persona responsable; las evaluaciones y adjudicaciones del piloto las produjo un agente de IA (D26). Las reglas se redactaron a partir de esas adjudicaciones y de la recodificación de 8 celdas (n = 8): la convergencia muestra que son aplicables tal como están escritas, **no que sean válidas**. La validez se evaluará con la campaña de ~150 celdas.
