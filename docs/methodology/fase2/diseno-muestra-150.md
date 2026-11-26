# Diseño de la muestra de la campaña humana de ~150 celdas (manual v0.2) — APROBADO Y EJECUTADO (muestra y paquetes congelados; evaluaciones aún no iniciadas)

Fecha: 2026-11-26. **Aprobado por la persona responsable** (mensaje comunicado 2026-11-26) con precisiones estadísticas incorporadas abajo. Campaña creada en el panel local; no se ha evaluado nada todavía. **E permanece sellado**: el diseño usa solo las preguntas de desarrollo (script `scripts/methodology/design_sample_150.mjs`, que no carga las celdas de E). Detalle por celda en local.

## 1. Población de referencia
Celdas (pregunta × partido) de las **56 preguntas de desarrollo no regionales × 19 partidos = 1.064 celdas**. Se excluyen las **19 celdas del piloto** (codificadas por un agente) → **marco de 1.045 celdas**. Las 8 recodificaciones con el borrador v0.2 no se reutilizan: se hicieron antes de la regla 2 final.
| Estrato (por la referencia provisional) | Celdas | % |
|---|---|---|
| positiva ±2 | 193 | 18,5 |
| positiva ±1 | 184 | 17,6 |
| negativa | 64 | 6,1 |
| neutral o condicionada | 2 | 0,2 |
| ambigua o no comparable | 4 | 0,4 |
| **sin posición registrada** | **598** | **57,2** |
Idioma del programa: castellano 84,5 %, catalán 10,4 %, gallego 5,1 %. Dimensión: Social 28,2 %, Instituciones 21,6 %, Derechos 18,1 %, Economía 14,3 %, Territorio 10,8 %, Medio ambiente 7,0 %. Por partido: 53–56 celdas cada uno.

## 2. Método de muestreo (150 = representativa 105 + dirigida 45; nunca se mezclan en una cifra)
**R — Representativa (105), aleatoria estratificada del marco, con pesos de diseño:**
| Submarco | n | Reparto |
|---|---|---|
| Con posición registrada | 60 | positiva ±2: 17 · positiva ±1: 17 · negativa: 20 (sobremuestreo: pocas) · neutral/ambigua: 6 (censo) |
| **Sin posición registrada** | **45** | aleatoria (para estimar la proporción con posición recuperable) |
Dentro de cada estrato, selección sistemática tras ordenar por partido, dimensión e idioma (estratificación implícita) con semilla fija registrada: reparte partidos, dimensiones e idiomas (≈ 11 celdas en catalán y ≈ 5 en gallego). Se comprueba al final que ningún partido quede sin celdas.

**T — Dirigida (45), analizada aparte:** 20 celdas sin posición con candidatas de posición (de las 603 celdas sin posición con candidatas del análisis previo; **prioriza, no es una tasa**), las **21 celdas restantes del conjunto S** (tienen codificaciones de IA: incluyen casos **concordantes y discrepantes**) y 4 de reserva para fallos de recuperación detectados por la comprobación sistemática de la cita registrada.

La muestra **no está sesgada solo hacia casos problemáticos**: el 70 % es aleatoria; los casos dirigidos (30 %) se declaran y se analizan por separado. Cobertura de «sin posición»: 45 aleatorias + 20 dirigidas.

## 3. Tratamiento de lo ya evaluado
Piloto (19, agente) y recodificación (8, persona, borrador): fuera del marco; se conservan íntegros y no se recalculan. **Repetibilidad:** se reevalúan 15 celdas de R (aleatorias) al menos 7 días después, en orden nuevo, sin ver la respuesta anterior (campaña de repetibilidad aparte; no forman parte de las 150).

## 4. Evidencia mostrada
Los 10 pasajes de la recuperación **B-1.0.0** (la de los benchmarks, para comparabilidad; **no** se adopta B-2.0.0 mientras reordene lo que ven los evaluadores) y la opción «pedir más contexto». Antes de evaluar, se ejecuta la comprobación sistemática «¿la cita registrada está en lo recuperado?» (en local, sin modelos de lenguaje) y se marcan los fallos.

## 5. Precisión (justificación del tamaño)
Semiancho del IC 95 % de Wilson para una proporción (puntos porcentuales):
| n | p = 0,5 | p = 0,8 | p = 0,9 |
|---|---|---|---|
| 45 | 14,0 | 11,5 | 9,0 |
| 60 | 12,3 | 10,0 | 7,7 |
| 105 | 9,4 | 7,6 | 5,8 |
| 150 | 7,9 | 6,4 | 4,8 |
Con R (105) se estima la concordancia global con una precisión de ±6 a ±9 puntos; la proporción de posición recuperable entre las celdas sin posición, con n = 45, de ±9 a ±14 puntos. Por estrato (≈ 17–20 celdas) solo se describe: ±15–20 puntos. **Detecta problemas gruesos; no permite afirmaciones finas.**

## 6. Trabajo manual
≈ 2–4 min por celda con v0.2 y diez pasajes → **5–10 h** las 150, en unas 6 sesiones de ~25 celdas (orden aleatorio, para repartir la fatiga) + 0,5–1 h de repetibilidad. Preparación (recuperación local en GPU, comprobación de citas, campaña): < 1 h, sin modelos de lenguaje.

## 7. Métricas
Humano frente a la **referencia provisional** (no es verdad terreno): clase exacta, kappa de Cohen, **Krippendorff nominal** (clase) y **ordinal** (intensidad), **kappa ponderado**, **Gwet AC1/AC2**, acuerdo exacto, MAD, discrepancias de signo, con IC (bootstrap 1.000 y Wilson). Proporción de posición hallada en celdas sin posición (con IC de Wilson y pesos). Repetibilidad intraevaluador con las mismas métricas. **Humano–IA** solo con celdas codificadas por IA (las de S); para el resto exigiría ejecuciones de modelos, que requieren **autorización expresa** (A y B siguen cerrados). R se informa con pesos de diseño y T aparte.

## 8. Limitaciones
- **Un único evaluador humano interno**: no hay concordancia humano–humano; no es referencia independiente; es el diseñador del sistema; procedencia declarada, no verificada de forma independiente.
- La referencia es **provisional**: se mide concordancia, no exactitud.
- Marco limitado a 56 de las preguntas (desarrollo): no generaliza a las no regionales de E ni a todo el banco; los estratos pequeños son solo descriptivos.
- Ceguera parcial (conocimiento del proyecto; los pasajes pueden delatar al partido).
- Sobre las preguntas de desarrollo se ajustaron prompts y recuperación: cualquier comparación humano–IA sobre estas celdas **no es una estimación limpia de generalización**.

## 9. Sobre E (sellado)
La partición original reservaba E (146 celdas) como «candidato al piloto humano». **No se accede a E.** Usar E como marco de esta campaña requeriría **autorización específica**. Recomendación: no usarlo ahora (el manual y la recuperación aún pueden cambiar) y reservarlo para una campaña final con todo congelado.

## 10. Decisiones pendientes
1. ¿Se aprueba el diseño (R 105 + T 45, repetibilidad de 15)?
2. ¿Marco de desarrollo ahora (recomendado) o autorización para E?
3. ¿Se autoriza la ejecución local de la recuperación B-1.0.0 y la comprobación de la cita registrada sobre las celdas elegidas (sin modelos de lenguaje)?
4. ¿Se autorizan, más adelante, ejecuciones de IA sobre las 150 para comparar humano–IA?

## 11. Resultado de la ejecución (2026-11-26)
**Cambios sobre la propuesta (precisados al ejecutar):**
- **Marco de R = 1.024 celdas** (desarrollo 1.064 − 19 del piloto − 21 restantes de S, que entran con certeza en T). Las estimaciones de R se refieren a ese marco.
- **Reservas.** Se evalúan **146** celdas planificadas (105 R + 20 T1 + 21 T2). Las **4 reservas** de T1 y, para R, el **reemplazo predefinido** de cada elegida (la siguiente no elegida del mismo estrato en el orden del muestreo) solo sustituyen a una celda **técnicamente inválida** (sin paquete de evidencia, < 3 pasajes con texto o programa sin texto extraíble), comprobado **antes** de empezar. **Nunca** por dificultad, discrepancias, ausencia de cita registrada o resultados. En la ejecución: **0 celdas inválidas, 0 sustituciones** (el tope de 150 solo se alcanzaría si hiciera falta usar las reservas).
- **T1:** regla preinscrita: celdas sin posición no elegidas en R, ordenadas por la puntuación BM25 de su mejor candidata (spike de silencio), de mayor a menor (empate por identificador).

**Estratos de R, probabilidades de inclusión y pesos (π = n/N, peso = 1/π):**
| Estrato | N | n | π | Peso |
|---|---|---|---|---|
| positiva ±2 | 188 | 17 | 0,0904 | 11,06 |
| positiva ±1 | 180 | 18 | 0,1000 | 10,00 |
| negativa | 60 | 20 | 0,3333 | 3,00 |
| neutral o condicionada | 1 | 1 | 1 | 1 (censo) |
| ambigua o no comparable | 4 | 4 | 1 | 1 (censo) |
| sin posición registrada | 591 | 45 | 0,0761 | 13,13 |
**Tamaño efectivo de Kish de R: 88,7 de 105** (los pesos desiguales reducen el tamaño efectivo). Semillas registradas (muestreo sistemático tras ordenar por partido, dimensión, idioma e identificador): 150101 (±2), 150102 (±1), 150103 (negativa), 150104 (sin posición), 150105 (repetibilidad), 150106 (orden de presentación). Huella del diseño `f6ec6a7a49c2…`; paquetes de evidencia `368419335437…` (recuperador B-1.0.0, huella `acd59e441e09…`); manual v0.2 `ed7aaf955574…`. Cobertura de R: 19 partidos (4–8 celdas cada uno), idiomas es 87 / ca 13 / gl 5; dimensiones Social 38, Instituciones 21, Territorio 16, Economía 13, Derechos 12, Medio ambiente 5.

**Estimación con el diseño (no como muestra aleatoria simple):** `scripts/methodology/sampling.mjs` implementa la estimación estratificada con pesos y corrección de población finita (p̂ = Σ W_h p̂_h; varianza Σ W_h²(1 − f_h)p̂_h(1 − p̂_h)/(n_h − 1); IC en escala logit) y el tamaño efectivo de Kish; con pruebas. En cada análisis se informan N, n y n efectivo; R se analiza con pesos, T aparte.

**Tamaño total frente a pares humano–IA disponibles:** solo las **21 celdas de T2** (restos de S) tienen codificaciones de IA comparables (modalidad B). Las 105 de R **no** tienen IA: sobre ellas se mide concordancia con la referencia provisional y repetibilidad, **no** humano–IA, salvo que más adelante se autoricen ejecuciones de IA. El tamaño efectivo de cada métrica humano–IA será, por tanto, n ≈ 21 (a verificar con la comprobación de pares válidos), no 150.

**Comprobación de la cita registrada en lo recuperado (local, sin modelos; no se muestra al evaluador):** de las celdas con cita registrada, no se recupera en 11 de 60 (R) y 1 de 14 (T). **No se sustituyen**: son información (error de recuperación), y se analizarán después.

**Estados diferenciados** (para no confundir ausencias): evidencia **recuperada** (instantánea versionada de la celda); **cita registrada** (referencia; oculta durante la evaluación); **contexto insuficiente** (`insufficient_context` de la evaluación); **ausencia de mención en los pasajes** (clase `not_mentioned`); **ausencia confirmada en el programa completo** (tabla `eval_absence_checks`, comprobación posterior con búsqueda y términos registrados; no forma parte de la evaluación ciega).

**Campaña:** «Campaña humana v0.2 — muestra de desarrollo (150)», 146 celdas en orden aleatorio, asignada a «Humano interno 1», con el manual v0.2 congelado y evidencia B-1.0.0 congelada. El diseño muestral (R/T, estrato, peso) está en `eval_sample_design` y **ninguna API de evaluación lo lee**. **No se modifican manual, muestra ni paquetes durante la campaña**; cualquier problema metodológico se registra para el análisis posterior, sin cambios silenciosos. Repetibilidad: las 15 celdas están **preinscritas** (`repeat_selected`) y se repetirán ≥ 7 días después con `create_repeatability_campaign.mjs --design`.
