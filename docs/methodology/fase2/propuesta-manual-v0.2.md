# Propuesta de revisión del manual de codificación (v0.1-benchmark → v0.2) — BORRADOR, NO APLICADO

Fecha: 2026-11-25. Origen: causas de manual (`manual_insufficient`) y de interpretación registradas al adjudicar el piloto de 19 celdas (evaluador humano interno; muestra dirigida; n muy pequeño). Los casos concretos y las citas quedan en local (`docs/methodology/local/`); aquí solo se formulan reglas generales. **Nada de esto se aplica sin decisión expresa.** El manual v0.1 sigue siendo el de las evaluaciones del benchmark y del piloto; cualquier recodificación con v0.2 es una **campaña nueva** y no es comparable sin más con las de v0.1.

## 1. Qué es una «medida cercana» (`supports`/`opposes` con ±1)
**Problema.** v0.1 menciona «una medida cercana» para ±1 sin definirla. Permite desde una medida con el mismo objeto y otro instrumento hasta una orientación competencial general, y el criterio cambia según quien codifica.

**Propuesta (a decidir).** Una medida es **cercana** solo si cumple las tres condiciones:
1. Tiene el **mismo objeto** que la proposición (qué se regula o a quién afecta).
2. Actúa en la **misma dirección** y sobre el **mismo mecanismo o un instrumento sustituto** que el lector razonable consideraría equivalente.
3. Es una **medida concreta** del programa (no una orientación genérica, un principio o una reclamación competencial).

Si falta (1) o (3), la clase es `not_mentioned`, aunque el tema se nombre de pasada. Si falta solo (2) —misma dirección pero distinto instrumento (p. ej. ayuda directa frente a deducción)—, **opción A:** `not_mentioned` (conservadora); **opción B:** ±1 con la marca «medida cercana» en la justificación y no publicable hasta ser verificada. *Recomendación:* A para el banco publicable y registrar B como etiqueta de diagnóstico, para no estirar posiciones por inferencia.

## 2. Frases que suponen la medida sin defenderla («si hay aumentos, que no recorten servicios»)
**Problema.** Una cláusula condicional o de garantía presupone que la medida ocurrirá, pero ni la propone ni la rechaza. Leerla como apoyo convierte una salvedad en un compromiso; leerla como rechazo la exagera.

**Propuesta.** Una cláusula que **presupone** la medida **no cuenta por sí sola** como apoyo ni como oposición. La clase se decide por **los compromisos propios** del programa sobre el objeto: orientación general, medidas explícitas, reducciones o ampliaciones. La cláusula presuposicional se cita como contexto, **no como cita registrada de la posición**. Si, aparte de ella, el programa no dice nada sobre el objeto → `not_mentioned`; si hay señales contrarias y a favor → `ambiguous`.

## 3. ¿Qué cuenta como condición que reduce el alcance (+2 frente a +1)?
**Problema.** v0.1 dice +2 «sin salvedades que recorten su alcance» y +1 «parcial, vago, condicionado». No distingue qué condiciones recortan el alcance.

**Propuesta (a decidir), por tipos:**
| Tipo de condición | ¿Recorta el alcance? |
|---|---|
| Criterio que restringe **quién** accede a la medida o **cuánto**, propio de esa medida (p. ej. mérito, nacionalidad, tramos) | **Sí** → ±1, salvo que el texto de la pregunta ya lo contemple |
| Condición sobre **cuándo** (plazos, calendarios graduales) | No, si el compromiso es firme y fechado |
| **Regla fiscal o de financiación general**, aplicable a todas las medidas del programa | **Opción A:** no recorta (es marco común); **Opción B:** recorta si la regla puede dejar sin efecto la medida concreta. *Recomendación:* A, con la regla anotada en las condiciones |
| Condición **específica** de esa medida que puede impedirla (p. ej. «solo si se certifica un ahorro») | Sí |
| Vaguedad (sin cuantía, objetivo ni plazo) | Mantiene ±1 por vaguedad, no por condición |

## 4. Citas (manual y comprobación)
**Manual (añadir):** la cita debe ser (a) **literal** y copiada de un único pasaje, con su página; (b) la que **sostiene la clase por sí misma** —debe referirse a la medida y no solo al tema—; (c) si la cita es una garantía o cláusula presuposicional, no vale como evidencia de la posición (apartado 2).

**Comprobación (`scripts/methodology/citation_check.mjs`).** Sustituye a la comprobación de bolsa de palabras de la modalidad B, que daba como «aproximada» una cita recompuesta con palabras sueltas de varios pasajes. Niveles: literal, fragmentos con elipsis, casi literal (≥ 90 % de la secuencia; se listan las palabras ausentes), dispersa (sospechosa) y no encontrada, más la página citada. **Límite:** no detecta una cita literal que no sostiene lo que afirma la justificación; eso solo lo detecta una revisión humana o, en el futuro y con autorización, una comprobación de apoyo con un modelo (no se usa ahora).

## 5. Recuperación documental (no es una regla del manual, pero afecta a todas)
Comprobar si la cita registrada está en lo recuperado detecta fallos de recuperación (en el piloto, el único error de recuperación desvió a todos los evaluadores). Propuesta: ejecutar esa comprobación en toda codificación de modalidad B y marcar las celdas donde falla, **antes** de comparar evaluadores.

## 6. Cómo validar v0.2 antes de usarlo
1. Revisión por el responsable (decisiones marcadas «a decidir»).
2. Recodificar **a mano** las celdas del piloto cuyo desacuerdo se atribuyó al manual, aplicando v0.2, **sin** modelos nuevos, y comprobar que el resultado es el esperado.
3. Solo entonces, valorar una campaña humana con v0.2 (con repetibilidad intraevaluador **separada**: si se repite con un manual distinto, no se puede atribuir la diferencia al paso del tiempo).
4. Mantener los benchmarks A y B cerrados; cualquier nueva ejecución de modelos con v0.2 requiere autorización expresa.

## 7. Decisiones pendientes
1. Medida cercana: ¿opción A o B cuando falta solo el mismo mecanismo?
2. Cláusulas presuposicionales: ¿no cuentan por sí solas (propuesta)?
3. Regla fiscal general: ¿A (no recorta) o B (recorta si puede dejar sin efecto la medida)?
4. Criterios de reparto propios de la medida (mérito, nacionalidad): ¿recortan el alcance (propuesta: sí)?
5. Citas: ¿se adopta la comprobación por niveles y la regla (a)–(c)?
