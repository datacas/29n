# Banco exhaustivo (v2): documento de trabajo

**Estado: borrador.** Primera pasada con los cinco programas cortos (FASCI19, NSDAP20, TESIS17, FE34, BN34). Faltan los largos: PNF21, PCR19, FP36, CEDA33 y DER33. Cuando estén todos se fusionan las candidatas, se fija el texto de cada pregunta y se añaden las citas a `citas/`.

## Reglas del banco v2

- **Exhaustivo:** toda propuesta concreta de un programa debe acabar en alguna pregunta, salvo que sea puramente coyuntural (por ejemplo, «sistemación de los ferroviarios» o «confraternización en el frente»).
- **Una pregunta de un solo programa solo puntúa para ese programa.** Para los demás no cuenta (no tienen posición). Lo implementa el modo exhaustivo del selector (`consultation.exhaustive`).
- **Niveles de profundidad:**

| Nivel | Qué preguntas | Sale en |
|---|---|---|
| 1 | Las 15 comparativas actuales | Rápida, Normal y Completa |
| 2 | Con posición de 2 o más programas | Normal y Completa |
| 3 | De un solo programa | Completa |

- **Tope: 80 preguntas en total.** Las propuestas parecidas de varios programas se agrupan en una pregunta.
- Las preguntas de nivel 2 y 3 se redactan igual de neutras que las 15 actuales. Se mantiene el cupo de preguntas formuladas en sentido de mercado, libertad u orden.

## Candidatas de los programas cortos

`+` a favor · `−` en contra · `(±)` débil · `~` ambigua. Entre paréntesis, el punto del texto.

### Régimen, Estado y orden
| # | Candidata | Programas | Nivel |
|---|---|---|---|
| C1 | La representación política debe organizarse por profesiones y corporaciones, no por partidos (fila B, retirada del banco v1) | FASCI19 (+) cons. técnicos; NSDAP20 (+) p. 25; FE34 + p. 6; BN34 + | 2 |
| C2 | Es legítimo conquistar el poder por la fuerza o en la calle, fuera de las urnas | FE34 + (pp. 26–27, «revolución nacional»); BN34 + («la tribuna, la prensa, el libro y la calle»); TESIS17 (+) | 2 |
| C3 | España debería volver a ser una monarquía | BN34 (+) («la gloriosa bandera bicolor»); *falta ver CEDA, FP* | 2 |
| C4 | Debe abolirse el Senado o la segunda cámara | FASCI19 + | 3 |
| C5 | Se debe poder votar desde los 18 años | FASCI19 + | 3 |
| C6 | Hay que suprimir la policía y la burocracia, y que los cargos públicos sean elegidos, revocables y cobren como un obrero | TESIS17 + | 3 |
| C7 | La pena de muerte debe aplicarse a usureros y especuladores | NSDAP20 + (p. 18) | 3 |
| C8 | El derecho del país debe sustituir al derecho romano | NSDAP20 + (p. 19) | 3 (¿descartar por demasiado técnica?) |
| C9 | El Estado debe poder prohibir obras de arte, libros y espectáculos que considere dañinos | NSDAP20 + (p. 23) | 3 |

### Nación, ciudadanía y exterior
| # | Candidata | Programas | Nivel |
|---|---|---|---|
| C10 | La ciudadanía y los cargos públicos deben reservarse a quienes son del pueblo por origen o sangre | NSDAP20 + (pp. 4–6); *PCR19 − (igualdad de nacionalidades)* | 2 |
| C11 | Hay que cerrar la inmigración y expulsar a los inmigrantes recientes | NSDAP20 + (pp. 7–8) | 3 |
| C12 | Los tratados de paz impuestos tras una guerra deben anularse o revisarse | NSDAP20 + (p. 2); *PNF21 + revisión* | 2 |
| C13 | La política exterior debe buscar la paz y apoyarse en organismos internacionales | FASCI19 (+); TESIS17 + (paz sin anexiones); *FP36 + SdN; PNF21 − SdN* | 2 |
| C14 | Hay que impulsar la revolución en otros países | TESIS17 + (nueva Internacional); *PCR19 +* | 2 |
| C15 | Un país necesita unas fuerzas armadas poderosas y que el espíritu militar impregne la vida nacional | FE34 + (pp. 4–5); BN34 + («columna vertebral del Estado»); *PNF21 +* | 2 |

### Economía y propiedad
| # | Candidata | Programas | Nivel |
|---|---|---|---|
| C16 | Hay que confiscar los beneficios de guerra y de la especulación | FASCI19 + (85 %); NSDAP20 + (p. 12) | 2 |
| C17 | Deben suprimirse las rentas que se cobran sin trabajar, como los intereses | NSDAP20 + (p. 11) | 3 |
| C18 | Hay que proteger al pequeño comercio frente a las grandes superficies | NSDAP20 + (p. 16); *FP36 + pequeña industria y comercio* | 2 |
| C19 | La tierra debe repartirse en pequeñas propiedades familiares, no en grandes explotaciones colectivas | FE34 + (p. 19); *CEDA33 +, PNF21 +, FP36 (+) asentamientos, PCR19 − (granjas estatales)* | 2 |
| C20 | El Estado debe garantizar precios mínimos a los productos del campo y crédito barato a los agricultores | FE34 + (p. 18); *FP36 +, CEDA33 +* | 2 |
| C21 | Capital y trabajo deben colaborar; la lucha de clases debe desaparecer | FE34 + (p. 11); BN34 +; *CEDA33 +, PNF21 +, PCR19 −, TESIS17 −* | 2 (muy discriminante) |
| C22 | Los sindicatos obreros deben poder gestionar industrias y servicios públicos | FASCI19 + (social, d); *PNF21 +* | 2 |
| C23 | La industria de armamento debe ser del Estado | FASCI19 + (militar, b) | 3 |

### Trabajo y protección social
| # | Candidata | Programas | Nivel |
|---|---|---|---|
| C24 | Todo el que pueda tiene el deber de trabajar | NSDAP20 + (p. 10); FE34 + (p. 16); *PCR19 +* | 2 |
| C25 | Hay que mejorar las pensiones o adelantar la edad de jubilación | FASCI19 + (55 años); NSDAP20 + (p. 15) | 2 |
| C26 | Sindicatos únicos y obligatorios de trabajadores y empresarios, organizados por el Estado (retirada del v1) | FE34 + (p. 9); BN34 ~; *PNF21 +; CEDA33 ~ «corporación obligatoria»* | 2 |
| C27 | Hay que prohibir el trabajo infantil y proteger a las madres trabajadoras | NSDAP20 + (p. 21); *PCR19 +, CEDA33 +* | 2 |

### Iglesia, escuela y juventud
| # | Candidata | Programas | Nivel |
|---|---|---|---|
| C28 | Deben confiscarse los bienes de las órdenes religiosas | FASCI19 + (financiero, b); *DER33 −, CEDA33 −* | 2 |
| C29 | El Estado debe pagar los estudios, también los superiores, a los alumnos capaces sin recursos | NSDAP20 + (p. 20); FE34 + (p. 24); *FP36 +, PCR19 +* | 2 |
| C30 | La educación física y la formación premilitar deben ser obligatorias para los jóvenes | NSDAP20 + (p. 21); FE34 + (p. 23); *PNF21 +, PCR19 +* | 2 |
| C31 | El Estado puede movilizar obligatoriamente a los jóvenes para trabajos de interés nacional | FE34 + (p. 20) | 3 |

**Recuento provisional:** 31 candidatas de los programas cortos, más las 15 del v1, son 46. Quedan unas 34 plazas para lo que aporten los cinco programas largos que no esté ya aquí. Varias candidatas ya llevan posiciones de los largos (en cursiva), que hay que confirmar con su cita.

## Siguiente paso
1. Extraer PNF21, PCR19, FP36, CEDA33 y DER33 con el mismo criterio.
2. Fusionar, cerrar el texto de cada pregunta y asignar su nivel.
3. Añadir las posiciones y citas a `citas/`, actualizar `cargar.ts` y publicar la versión 2.0.0 de la histórica.
