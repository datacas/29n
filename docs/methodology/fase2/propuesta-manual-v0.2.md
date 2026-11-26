# Revisión del manual de codificación (v0.1-benchmark → v0.2) — DECISIONES DEL RESPONSABLE INCORPORADAS; NO APLICADO

> **ERRATA 2026-11-25 (D26).** Las evaluaciones ciegas y las adjudicaciones del piloto registradas como «Humano interno 1» las produjo **un agente de IA que operaba esa cuenta**, no una persona (declaración del propio agente; corroborada por los tiempos: 19 evaluaciones en 54 s). Por tanto el piloto **no es una validación humana**: las comparaciones «humano interno–IA» de este piloto son **IA–IA**, y las adjudicaciones y las decisiones sobre el manual v0.2 que se le atribuyeron **no están ratificadas por la persona responsable**. El piloto sí vale como prueba de la interfaz, de la trazabilidad y del procedimiento. Ver D26 en `proceso-completo.md`.

Fecha: 2026-11-25. Origen: causas de manual (`manual_insufficient`) y de interpretación registradas al adjudicar el piloto de 19 celdas (evaluador humano interno; muestra dirigida; n muy pequeño). Los casos concretos y las citas quedan en local (`docs/methodology/local/`); aquí solo se formulan reglas generales. **Estado:** el responsable adoptó el 2026-11-25 las cinco decisiones de la sección 7 (con los matices que se recogen abajo). **Sigue sin aplicarse**: falta su orden expresa de publicar v0.2 como manual vigente. El manual v0.1 sigue siendo el de las evaluaciones del benchmark y del piloto; cualquier recodificación con v0.2 es una **campaña nueva** y no es comparable sin más con las de v0.1.

## 1. Qué es una «medida cercana» (`supports`/`opposes` con ±1)
**Problema.** v0.1 menciona «una medida cercana» para ±1 sin definirla. Permite desde una medida con el mismo objeto y otro instrumento hasta una orientación competencial general, y el criterio cambia según quien codifica.

**Propuesta (a decidir).** Una medida es **cercana** solo si cumple las tres condiciones:
1. Tiene el **mismo objeto** que la proposición (qué se regula o a quién afecta).
2. Actúa en la **misma dirección** y sobre el **mismo mecanismo o un instrumento sustituto** que el lector razonable consideraría equivalente.
3. Es una **medida concreta** del programa (no una orientación genérica, un principio o una reclamación competencial).

Si falta (1) o (3), la clase es `not_mentioned`, aunque el tema se nombre de pasada. Si falta solo (2) —misma dirección pero distinto instrumento (p. ej. ayuda directa frente a deducción fiscal)—, **decisión adoptada: opción A, `not_mentioned`.** La opción B (±1 con marca) se descarta porque convierte una inferencia en algo que parece una posición del partido. Una medida de otra naturaleza **puede** citarse en la justificación como contexto, nunca como posición.

## 2. Frases que suponen la medida sin defenderla («si hay aumentos, que no recorten servicios»)
**Problema.** Una cláusula condicional o de garantía presupone que la medida ocurrirá, pero ni la propone ni la rechaza. Leerla como apoyo convierte una salvedad en un compromiso; leerla como rechazo la exagera.

**Propuesta.** Una cláusula que **presupone** la medida **no cuenta por sí sola** como apoyo ni como oposición. La clase se decide por **los compromisos propios** del programa sobre el objeto: orientación general, medidas explícitas, reducciones o ampliaciones. La cláusula presuposicional se cita como contexto, **no como cita registrada de la posición**. Si, aparte de ella, el programa no dice nada sobre el objeto → `not_mentioned`; si hay señales contrarias y a favor → `ambiguous`. **Matiz adoptado:** la cláusula se registra como **señal de diagnóstico** (etiqueta `presuposicional` en la justificación) para que no se pierda: ayuda a entender lecturas divergentes entre evaluadores. Si más adelante se quiere explotar de forma estructurada, bastaría un campo de etiquetas de diagnóstico (migración futura; no necesario ahora).

**Precisión de la regla 2 — qué es un «compromiso propio sobre el objeto» (propuesta tras la recodificación de 8 celdas por una persona).** Al aplicar la regla, un caso mostró que «compromisos propios» admite dos lecturas: la **orientación general** del apartado frente a un compromiso **sobre la magnitud concreta** que pregunta la proposición. Se propone que un pasaje solo sea compromiso propio si cumple las dos condiciones siguientes:
1. **Misma magnitud y mismo nivel.** Declara la dirección (más, menos o mantener) de **la misma magnitud** por la que pregunta la proposición (p. ej. el nivel de gasto, no su composición ni su eficiencia) **en el mismo nivel de gobierno** (p. ej. el Estado, no un agregado europeo).
2. **Prueba de compatibilidad.** Si la medida citada es **compatible con ambos sentidos** de la proposición (p. ej. «reducir duplicidades» o «auditar el gasto» pueden acompañar tanto a más como a menos gasto), **no fija el sentido** y no cuenta.

Las secciones de orientación general (paz, valores, contexto) son **contexto**, no compromiso. Si ningún pasaje cumple las dos condiciones → `not_mentioned`; si hay señales contrarias que sí las cumplen → `ambiguous`.

*Opciones.* **A (recomendada):** la regla anterior; coherente con la decisión de «medida cercana» (no convertir una inferencia en posición) y con el criterio conservador del manual. **B:** una orientación general inequívoca cuenta como ±1 («compromiso por orientación»); se descarta porque reintroduce la inferencia que la regla de medida cercana quiere evitar.

*Efecto en lo ya registrado (solo lectura de las adjudicaciones; sin modelos):* afecta a **una** adjudicación del piloto, la de la celda 12 (hoy −1 por una medida de eficiencia a nivel europeo), que pasaría a `not_mentioned` con la opción A, y no se ve que afecte a las demás. Tu recodificación con v0.2 de esa celda ya dio `not_mentioned`. Si apruebas la opción A, se registraría una **revisión nueva** de esa adjudicación (la anterior se conserva).

## 3. ¿Qué cuenta como condición que reduce el alcance (+2 frente a +1)?
**Problema.** v0.1 dice +2 «sin salvedades que recorten su alcance» y +1 «parcial, vago, condicionado». No distingue qué condiciones recortan el alcance.

**Propuesta (a decidir), por tipos:**
| Tipo de condición | ¿Recorta el alcance? |
|---|---|
| Criterio de reparto **acotado**: solo cuenta si (i) restringe **a quién llega** la medida (p. ej. nacionalidad) o (ii) coincide con **el lado contrario que plantea la propia pregunta** (p. ej. ligar las ayudas al mérito cuando la pregunta lo presenta como la alternativa) | **Sí** → ±1. Otros criterios de asignación (tramos de renta, procedimiento) no recortan por sí solos: si cualquier criterio contara, casi ninguna medida llegaría a ±2 |
| Condición sobre **cuándo** (plazos, calendarios graduales) | No, si el compromiso es firme y fechado |
| **Regla fiscal o de financiación general**, aplicable a todas las medidas del mismo tipo | **No recorta** (describe la política fiscal del partido, no rebaja esa promesa), **salvo** que vaya ligada a esa medida en concreto o la haga explícitamente opcional («si la economía lo permite»). Se anota en la justificación |
| Condición **específica** de esa medida que puede impedirla (p. ej. «solo si se certifica un ahorro») | Sí |
| Vaguedad (sin cuantía, objetivo ni plazo) | Mantiene ±1 por vaguedad, no por condición |

## 4. Citas (manual y comprobación)
**Manual (añadir):** la cita debe ser (a) **literal** y copiada de un único pasaje, con su página; (b) la que **sostiene la clase por sí misma** —debe referirse a la medida y no solo al tema—; (c) si la cita es una garantía o cláusula presuposicional, no vale como evidencia de la posición (apartado 2).

**Comprobación automática (`scripts/methodology/citation_check.mjs`).** Sustituye a la comprobación de bolsa de palabras de la modalidad B, que daba como «aproximada» una cita recompuesta con palabras sueltas de varios pasajes. Niveles: literal, fragmentos con elipsis, casi literal (≥ 90 % de la secuencia; se listan las palabras ausentes), dispersa (sospechosa) y no encontrada, más la página citada. **Límite (reconocido por el responsable):** la parte «que sostenga la clase por sí misma» **no se puede comprobar automáticamente** —una cita literal puede no decir lo que afirma la justificación—. Necesita revisión humana o, en el futuro y con autorización expresa, un modelo dedicado a comprobar el apoyo (no se usa ahora). La comprobación por niveles cubre solo la literalidad, la procedencia y la página.

## 5. Recuperación documental (propuesta para una futura configuración de recuperación; no es una regla del manual)
Dos errores del piloto apuntan a la recuperación: un fragmento cortado ocultó la cita registrada y, en otra celda, faltaron páginas enteras. Medidas **locales** (sin llamadas a modelos de lenguaje):
1. **Ampliar el fragmento hasta el final de la frase** cuando se corta (en particular al cambiar de página: el troceado actual separa por página y puede cortar una frase que continúa en la siguiente).
2. **Ejecutar siempre la comprobación «¿la cita registrada está en lo recuperado?»** antes de comparar evaluadores, y marcar las celdas donde falla.

Medición orientativa sobre los programas (local, sin modelos): en torno al **9,5 %** de los finales de página terminan sin puntuación y continúan en la siguiente (112 de 1.181 páginas; mínimo estimado), y el **42,5 %** de los pasajes recuperados del piloto no terminan en puntuación final (incluye títulos y listas, así que sobrestima los cortes reales). Cambiar el troceado exige una **nueva versión de la configuración de recuperación** (la de B está congelada: huella `acd59e44…`); no se aplica sin decisión expresa y no altera los resultados de B.

## 6. Cómo validar v0.2 antes de usarlo
1. Revisión por el responsable (decisiones marcadas «a decidir»).
2. Recodificar **a mano** las celdas del piloto cuyo desacuerdo se atribuyó al manual, aplicando v0.2, **sin** modelos nuevos, y comprobar que el resultado es el esperado.
3. Solo entonces, valorar una campaña humana con v0.2 (con repetibilidad intraevaluador **separada**: si se repite con un manual distinto, no se puede atribuir la diferencia al paso del tiempo).
4. Mantener los benchmarks A y B cerrados; cualquier nueva ejecución de modelos con v0.2 requiere autorización expresa.

## 7. Decisiones adoptadas por el responsable (2026-11-25)
1. **Medida cercana:** opción A (`not_mentioned`). Consecuencia: las adjudicaciones previas que usaron una medida de distinto instrumento como posición deben revisarse con la regla (nueva revisión; las anteriores se conservan). Ver la nota local de coherencia.
2. **Cláusulas presuposicionales:** no cuentan por sí solas; se registran como señal de diagnóstico.
3. **Regla fiscal general:** no recorta el alcance, salvo que esté ligada a esa medida o la haga explícitamente opcional.
4. **Criterios de reparto:** solo los acotados (a quién llega; lado contrario que plantea la pregunta).
5. **Citas:** comprobación por niveles y regla (a)–(c); «sostiene la clase por sí misma» exige revisión humana o un modelo dedicado (futuro, con autorización).
6. **Precisión de la regla 2 («compromiso propio»: misma magnitud y nivel + prueba de compatibilidad):** **opción A APROBADA** por la persona responsable (2026-11-26), junto con la publicación de v0.2 como manual vigente para la campaña de ~150 celdas (`coding-manual-v0.2.md`, congelado; ver `manual-v0.2-cambios.md`).
Pendiente: orden expresa de publicar v0.2, y decidir si se implementa la nueva configuración de recuperación del apartado 5.
