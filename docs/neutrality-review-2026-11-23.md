# Revisión de neutralidad — 23/11/2026

Objetivo: comprobar que la aplicación no favorece a ninguna formación por diseño y que
las preguntas no están redactadas de forma que empujen la respuesta hacia un partido.

Alcance: contenido publicado (release `2.0.3`), banco de preguntas en base de datos,
selección dinámica de preguntas, motor de resultados y textos de la interfaz.
No se revisa aquí la veracidad de cada cita de los programas: eso corresponde a la
revisión editorial pregunta a pregunta.

---

## 0. Estado actual (23/11/2026, release `2.0.9` publicada)

Este informe se escribió sobre el borrador `2.0.4`. Lo que sigue resume qué es cierto hoy.
Las secciones 2, 3 y 6 conservan el análisis original, pero algunas de sus reglas se
sustituyeron por decisiones posteriores del editor.

| Tema | Estado |
|---|---|
| Preguntas con posición de un solo partido (§2) | **Decisión del editor:** entran en la release. El cuestionario las muestra solo si se elige ese partido, y se suman al total (como las regionales). Ya no se descartan. `build_release.ts` exige al menos un partido, y `select-questions.ts` aplica la regla de partido. |
| Regionales (§3) | **Sin tope.** Entran todas las de los partidos elegidos y se suman al número de preguntas generales (16, 32 o 56). El total fluctúa. |
| Orden de resultados y «Pocos datos» (§4) | Sin cambios. |
| Redacción (§5) | Aplicado en 8 preguntas (2.0.4) y, después, en 19 más al quitar la cláusula de finalidad («para hacer la educación más accesible», «para bajar el precio de la luz», etc.) y «grandes fortunas» en Q009 (2.0.7). Cambios en `docs/taxonomy/question_rewrites_2_0_7.json` y en la auditoría. |
| Cobertura desigual (§6) | **Resuelto en lo posible.** Se buscó evidencia literal para todos los partidos sin posición en las 12 preguntas detectadas y se añadieron 10 posiciones (`docs/review_cobertura_manual.json`). 5 preguntas siguen sin posición de derecha porque los programas no hablan de ello (jornada laboral, límite al turismo, depósito de envases, ley de seguridad ciudadana, financiación andaluza). **Decisión del editor:** se quedan. Se revisaron las 151 posiciones de `docs/revision_humana.md` y se corrigieron 4. |
| Contrapeso de aquiescencia | Se añadieron 25 preguntas formuladas para que el «sí» sea la postura de mercado, libertad u orden (`docs/taxonomy/balance_questions.json`, temas `bal-*`), con un cupo reservado del 20 % del cuestionario general. Se publicó en la 2.0.8 y la 2.0.9. |
| Aquiescencia: medición | Quien responde «de acuerdo» a todo obtiene entre un 56 % y un 87 % según el partido (rango de unos 30 puntos), con o sin contrapeso. El contrapeso no reduce ese rango: la distancia refleja que unos programas tienen posiciones más fuertes que otros (PP y FE de las JONS son más moderados, media de 0,9 y 0,7), no una dirección. El 12 % de las posiciones son «en contra». Se añadió una nota visible en los resultados y se explica en `/metodologia`. No se cambió la fórmula de cálculo. |
| Intensidad de codificación (§7) | **Sigue pendiente:** conviene fijar en la guía editorial cuándo una cita justifica ±2. |
| Otros | Estadísticas de uso anónimas (`/admin/stats`), compresión gzip y brotli, página `/metodologia`, y corrección del scroll horizontal en móvil. |

Para reproducir la medición de aquiescencia y la auditoría: `npm run audit:fairness -- --version <versión>`.

---

## 1. Resumen

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| 1 | Cuatro preguntas solo puntuaban a un partido | Alta | Corregido: excluidas del release y bloqueadas al construir |
| 2 | Hasta el 25 % del cuestionario rápido podían ser preguntas regionales | Alta | Corregido: tope del 10 % |
| 3 | Partidos con 6-7 posiciones podían encabezar el ranking por azar | Media | Corregido: marca «Pocos datos» y orden al final |
| 4 | Ocho preguntas con términos cargados o error de redacción | Media | Corregido en el banco y en el nuevo release |
| 5 | 9 preguntas solo tienen posición de partidos de izquierda/regionales y **0** solo de derecha | Alta | **Pendiente editorial** (ver §6) |
| 6 | La intensidad de codificación varía mucho entre partidos (de 36 % a 89 % de ±2) | Media | **Pendiente editorial** (ver §7) |

Comprobado y correcto: la lista de partidos va en orden alfabético, la calibración
baraja el orden de las dimensiones en cada sesión, no hay nombres de partidos escritos
en el código, los textos no recomiendan el voto y los resultados muestran cobertura y
evidencia.

---

## 2. Preguntas que solo puntúan a un partido (superado por una decisión posterior, ver §0)

En el release `2.0.3` había cuatro preguntas con posición de una sola formación. Una
pregunta así no compara: solo puede subir o bajar la media de ese partido, sin
contrapeso en los demás.

| Pregunta | Único partido |
|---|---|
| ¿Debe prohibirse el reconocimiento facial en los espacios públicos? | BNG |
| ¿Debe prohibirse el uso de redes sociales a los menores de 16 años? | PSOE |
| ¿Debe corregirse la infrafinanciación de la Comunitat Valenciana y condonarse su deuda histórica? | Compromís |
| ¿Deben transferirse a Galicia las competencias pendientes sobre infraestructuras, costas y recursos propios? | BNG |

Se aplican dos protecciones:

- `app/lib/survey/select-questions.ts` descarta cualquier pregunta que no puntúe al menos
  a dos de los partidos elegidos (cuando se comparan dos o más). Si la persona compara un
  único partido no hay comparación posible y la regla se relaja a una.
- `scripts/release/build_release.ts` exige dos partidos con posición aprobada para incluir
  una pregunta y lista las descartadas al construir el release.

El borrador `2.0.4` ya no incluye estas cuatro preguntas (80 en vez de 84).

---

## 3. Preguntas regionales (superado: ya no hay tope, ver §0)

Antes entraban siempre, hasta un 25 % del cuestionario. Cada pregunta regional suele
puntuar solo a la formación de esa comunidad (o a dos), así que en el modo rápido podían
ser 4 de 16 preguntas y decantar el resultado hacia ERC, PNV/EH Bildu, Coalición Canaria
o Compromís. Ahora el tope es el 10 %: 1 pregunta en rápida, 3 en normal y 4 en profunda
al seleccionar a los 19 partidos.

---

## 4. Orden de resultados (corregido)

El ranking ordenaba solo por porcentaje. Con 6-7 posiciones documentadas, una sola
respuesta mueve el resultado más de 10 puntos y podía colocar en cabeza a un partido por
azar (PCTE tiene 7 posiciones; PACMA, 15). A partir de ahora

- se marca «Pocos datos» si la cobertura es menor del 25 % **o** hay menos de 8 preguntas
  evaluables (sin exigir más de las contestadas);
- los marcados van al final de la lista, y los que no tienen datos al final del todo;
- el porcentaje mostrado no se modifica, y no se excluye a ningún partido.

Regla en `app/lib/scoring/ranking.ts`, documentada en `docs/scoring-methodology.md` §6.

---

## 5. Redacción (corregido)

| Pregunta (antes) | Problema | Ahora |
|---|---|---|
| ¿Deben protegerse los derechos de los inquilinos frente al **despido** y la subida **descontrolada** de rentas? | Error: los inquilinos no son despedidos, son desahuciados. «Descontrolada» es un juicio de valor. | ¿Deben reforzarse los derechos de los inquilinos frente a los desahucios y las subidas de renta? |
| ¿Debe derogarse la ley de seguridad ciudadana («**ley mordaza**»)? | Usa el apodo despectivo de sus críticos. | ¿Debe derogarse la Ley Orgánica de Protección de la Seguridad Ciudadana de 2015? |
| ¿Debe limitarse el número de turistas en las zonas **masificadas**? | Término cargado. | ¿Debe limitarse el número de visitantes en las zonas con mayor presión turística? |
| ¿Debe reformarse la financiación autonómica para que todas las comunidades reciban **lo mismo** por habitante? | Presenta una solución concreta como premisa. | ¿Debe reformarse la financiación autonómica para reducir las diferencias de recursos por habitante entre comunidades? |
| ¿Debe el Estado compensar a Andalucía con una inversión específica por su **infrafinanciación histórica**? | Presupone la injusticia histórica. | ¿Debe el Estado aumentar la inversión en Andalucía para corregir las diferencias de financiación por habitante? |
| ¿Debe corregirse la infrafinanciación de la Comunitat Valenciana y condonarse su **deuda histórica**? | Presupone la injusticia histórica. | ¿Debe corregirse la infrafinanciación de la Comunitat Valenciana y condonarse parte de su deuda? |
| ¿Debe **mantenerse y ampliarse** la ley de memoria democrática? | Doble pregunta. | ¿Debe mantenerse la Ley de Memoria Democrática de 2022? |
| ¿Debe crearse un sistema público universal de cuidados y dependencia **financiado por el Estado**? | Añade un modelo de financiación a una pregunta sobre cobertura. | ¿Debe crearse un sistema público de cuidados y dependencia de cobertura universal? |

Los cambios están aplicados en `questions.canonical_text`, en
`docs/taxonomy/question_drafts.json` y en el borrador `2.0.4`. Los contextos explicativos
(«¿Qué significa esto?») ya presentaban los dos argumentos, y se mantienen.

Nota metodológica: cambiar el sentido de una pregunta **no cambia el ranking** si se
invierte también el signo de las posiciones, porque la proximidad es simétrica. Lo que sí
introduce sesgo es una redacción cargada, porque empuja la respuesta de la persona, y la
cobertura desigual, porque unas preguntas solo puntúan a una parte.

---

## 6. Cobertura desigual (resuelto en lo posible, ver §0)

En `2.0.4` hay **9 preguntas con posiciones solo de partidos de izquierda o regionales y
0 con posiciones solo de partidos de derecha**:

1. ¿Debe reducirse la jornada laboral por debajo de 40 horas sin reducción salarial? (EH Bildu, PSOE, Sumar, Compromís)
2. ¿Debe ampliarse la duración y cuantía de las prestaciones por desempleo? (BNG, Frente Amplio)
3. ¿Debe adelantarse la neutralidad climática más allá de los compromisos actuales? (EH Bildu, Compromís, PACMA, Frente Amplio)
4. ¿Debe implantarse un sistema de depósito y retorno para envases? (Compromís, Democracia21, PACMA, BNG)
5. ¿Debe eliminarse la financiación pública de la Iglesia y la enseñanza religiosa? (Compromís, Frente Amplio, Adelante Andalucía)
6. ¿Debe mantenerse o aumentarse la AOD hasta el 0,7 % de la RNB? (PSOE, Sumar, Compromís, ERC, Frente Amplio, Adelante Andalucía)
7. ¿Debe priorizarse la escuela pública frente a la concertada y la privada? (6 partidos de izquierda)
8. ¿Debe reformarse la financiación autonómica para igualar recursos por habitante? (Compromís, Frente Amplio, Frente Obrero)
9. ¿Debe aumentar la inversión en Andalucía para corregir diferencias de financiación? (Frente Amplio, Adelante Andalucía)

*(La agrupación izquierda/derecha se usa solo como detector de cobertura de un solo lado; no
etiqueta a nadie ni entra en el cálculo. Las listas de partidos son las que tienen posición
en cada pregunta.)*

**Por qué importa:** si en una pregunta solo hay posición de un lado, quien responde «de
acuerdo» sube a esos partidos sin que los del otro lado bajen, y quien responde «en
desacuerdo» los baja sin que los otros suban. El efecto agregado es una ventaja para el
lado que tiene más posiciones documentadas, con independencia de la ideología de cada
persona.

**Causa:** no parece una decisión editorial, sino un hueco del extractor. Algunos
extremos claros están en los programas escaneados pero no se convirtieron en posición:

| Pregunta | Evidencia disponible en el escaneo |
|---|---|
| Escuela pública vs. concertada | PP, pág. 51: «Los padres elegirán colegio, y ningún concierto educativo se eliminará donde haya demanda suficiente». → posición contraria a priorizar la pública. |
| Neutralidad climática | PP, pág. 55: «ha llegado el momento de revisar los ritmos de cada sector». → posición contraria a adelantar el objetivo. |
| AOD 0,7 % | Vox, pág. 16: «Fin de la cooperación al desarrollo con los países que no colaboren en la gestión de los flujos migratorios». PP, pág. 57: «cambiar el modelo de cooperación… no tiene sentido mantener programas ineficaces». |
| Financiación autonómica | SALF, pág. 14: «Ni condonaciones ni moneda de cambio… financiación interterritorial justa, solidaria y responsable». PP, pág. 33: nuevo modelo «acordado de manera multilateral». |
| Prestaciones por desempleo | PNV, pág. 9: «Ampliar la cobertura de la prestación por desempleo hasta un máximo de 36 meses». |
| Jornada laboral | No hay una posición clara de PP/Vox en los párrafos escaneados. |
| Envases / SDDR | No hay una posición clara de PP/Vox en los párrafos escaneados. |
| Laicidad | No hay una posición clara de PP/Vox en los párrafos escaneados. |

**Recomendación:** antes de publicar `2.0.4`, añadir desde el panel de administración las
posiciones de la derecha que tengan cita literal (empezando por las cuatro primeras
filas, que son inequívocas). Si un tema no se puede documentar en ambos lados, valorar
excluirlo del cuestionario mientras se compara, o asumir explícitamente que la cobertura
es asimétrica. No se ha inventado ninguna posición en esta revisión.

---

## 7. Pendiente editorial: intensidad de codificación (sigue pendiente)

Porcentaje de posiciones codificadas como ±2 (postura fuerte):

| Partido | Posiciones | ±2 |
|---|---|---|
| Compromís | 48 | 85 % |
| Frente Amplio | 62 | 89 % |
| BNG | 43 | 79 % |
| PSOE | 52 | 71 % |
| PP | 49 | 57 % |
| Coalición Canaria | 22 | 36 % |
| PNV | 21 | 43 % |
| PACMA | 15 | 47 % |

La fórmula de proximidad `1 − |u−v|/4` hace que una posición moderada (+1) quede más
cerca de una respuesta neutra (0) que una posición fuerte (+2): un 75 % frente a un 50 %.
Si un partido se codifica sistemáticamente en +1 y otro en +2, el primero parece más
cercano a las personas moderadas por cómo se codificó, no por lo que dice el programa.
Conviene fijar en la guía editorial cuándo una cita justifica ±2 (apoyo/oposición
explícitos) y revisar los partidos con porcentajes muy distintos (CC, PNV, PACMA frente a
Compromís, Frente Amplio).

---

## 8. Cambios y verificación

Archivos modificados:

- `app/lib/survey/select-questions.ts`: mínimo de dos partidos por pregunta y tope del 10 % de regionales.
- `app/lib/scoring/ranking.ts` (nuevo): marca de pocos datos y orden del ranking.
- `app/pages/survey/[slug]/results.vue`: usa la nueva regla y lo explica en «Cómo leer estos resultados».
- `app/pages/survey/[slug]/start.vue`: avisa cuando dos partidos solo comparten menos de 5 preguntas.
- `scripts/release/build_release.ts`: no incluye preguntas de un solo partido y las reporta.
- `scripts/audit/fairness.ts` (nuevo): auditoría repetible.
- `db` (preguntas `Q008`, `Q038`, `Q049`, `Q068`, `Q069`, `Q077`, `Q084`, `Q085`) y `docs/taxonomy/question_drafts.json`.
- `docs/scoring-methodology.md`: regla de presentación.
- `tests/scoring/ranking.test.ts` (nuevo) y `tests/jev/jev.test.ts`: pruebas de las reglas nuevas.

Comandos:

```bash
npx vitest run                                   # 172 tests
npx nuxt build                                   # compila
node --experimental-strip-types scripts/audit/fairness.ts --version 2.0.4
```

*(Nota histórica: este informe se escribió sobre el borrador `2.0.4`. Hoy está publicada la `2.0.9`, ver §0.)*
