# Auditoría del banco de preguntas piloto — Informe editorial depurado

Generado: 2026-11-18
Fuente: 2.121 claims de 5 programas electorales reales (PSOE, PP, Vox, Sumar, ERC)

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Preguntas auditadas | 23 |
| Celdas con evidencia | 66/115 (57.4%) |
| Celdas sin evidencia | 49/115 (42.6%) |
| Posiciones `conditional_agrees` | 37 |
| Posiciones `disagrees` | 13 |
| Posiciones `unclear` | 16 |
| Posiciones `not_stated` | 49 |
| Casos unclear a nivel de claim | 118 |
| Problemas de formulación | 4 (todos low_comparability) |
| Posiciones aprobadas | 0 (todas en draft) |

**Conclusión:** El banco de 23 preguntas es una propuesta editorial sólida como punto de partida. El 57.4% de cobertura (66/115 celdas) es razonable para un piloto, pero requiere revisión humana antes de publicar. Ninguna posición ha sido aprobada automáticamente.

## 2. Auditoría de formulaciones

### 2.1 Problemas detectados

Solo se detectaron problemas de **baja comparabilidad** en 4 preguntas con evidencia de un solo partido:

| ID | Pregunta | Partido con evidencia | Severidad |
|---|---|---|---|
| Q008 | ¿Deben protegerse los derechos de los inquilinos...? | Sumar | Media |
| Q010 | ¿Deben reducirse los impuestos sobre la renta (IRPF)...? | PP | Media |
| Q013 | ¿Debe reforzarse la gestión y protección de los bosques...? | ERC | Media |
| Q023 | ¿Debe aumentarse la inversión en seguridad ciudadana...? | Vox | Media |

**No se detectaron:** preguntas dobles, lenguaje valorativo ni presuposiciones en las 23 formulaciones.

### 2.2 Evidencia adicional encontrada

La búsqueda transversal ha encontrado claims adicionales en otros partidos para las 4 preguntas de un solo partido:

**Q008 — Protección de inquilinos:**
- PSOE: 105 claims con la palabra "proteger" (muchos no son específicos de inquilinos)
- PP: 49 claims con "proteger" (generalmente sobre otros temas)
- Vox: 15 claims con "proteger" (fronteras, Ceuta/Melilla)
- ERC: 23 claims con "proteger" (derechos lingüísticos, centros educativos)
- **Conclusión:** La palabra "proteger" es demasiado genérica. Se necesita una búsqueda más específica para encontrar evidencia real sobre protección de inquilinos en otros partidos.

**Q010 — Reducción del IRPF:**
- PSOE: 19 claims con "IRPF" (algunos sobre deducciones, no reducción general)
- Vox: 19 claims con "IRPF" — **"Simplificación y bajada del IRPF. Reducción del tipo aplicable"** (pág 9)
- Sumar: 10 claims con "IRPF" (algunos sobre alquiler)
- ERC: 2 claims — **"reduir els tipus de la fiscalitat del treball per als trams inferiors als 35.000 euros"** (pág 21)
- **Conclusión:** Vox y ERC tienen evidencia clara sobre reducción del IRPF. Esta pregunta puede ampliarse a 3+ partidos.

**Q013 — Protección de bosques:**
- Los claims encontrados con "proteger" son genéricos, no específicos de bosques.
- **Conclusión:** ERC es el único partido con evidencia específica sobre bosques. La pregunta puede mantenerse pero con baja comparabilidad.

**Q023 — Inversión en seguridad:**
- Los claims encontrados con "proteger" son genéricos.
- ERC tiene un claim relevante: **"cal derogar la Llei mordassa"** (pág 7) — postura contraria a la seguridad policial.
- **Conclusión:** Se necesita búsqueda más específica. Vox es el partido con más evidencia sobre seguridad policial.

## 3. Matriz completa 23×5

### 3.1 Distribución de posiciones

| Postura | Cantidad | Porcentaje |
|---|---|---|
| `conditional_agrees` | 37 | 32.2% |
| `not_stated` | 49 | 42.6% |
| `disagrees` | 13 | 11.3% |
| `unclear` | 16 | 13.9% |

### 3.2 Diferenciación claim-level vs position-level

Es crucial distinguir:

- **Incidencias a nivel de claim (420):** Cada claim individual puede tener una postura unclear, condicional o ambigua. Los 118 unclear son a este nivel.
- **Incidencias a nivel de posición (16):** Cuando todos los claims de un partido para una pregunta son unclear, la posición resultante es unclear. Solo 16 de las 115 celdas caen en esta categoría.

La diferencia es importante porque una posición puede tener varios claims, algunos claros y otros unclear. La postura a nivel de posición se determina agregando los claims individuales.

### 3.3 Cobertura por dimensión

| Dimensión | PSOE | PP | Vox | Sumar | ERC |
|---|---|---|---|---|---|
| Economía y empleo | 5/5 | 3/5 | 1/5 | 4/5 | 1/5 |
| Estado de bienestar | 8/8 | 6/8 | 4/8 | 7/8 | 1/8 |
| Territorio y medio ambiente | 2/2 | 2/2 | 1/2 | 1/2 | 1/2 |
| Justicia y seguridad | 2/2 | 1/2 | 1/2 | 0/2 | 0/2 |
| Derechos y libertades | 4/4 | 3/4 | 1/4 | 3/4 | 2/4 |
| Gobernanza y democracia | 2/2 | 2/2 | 2/2 | 2/2 | 0/2 |

**Observaciones:**
- ERC tiene cobertura muy baja en Estado de bienestar (1/8) y Gobernanza (0/2).
- Vox tiene cobertura baja en Economía (1/5) y Derechos (1/4).
- Sumar tiene cobertura 0 en Justicia y seguridad.

## 4. Clasificación de los 118 casos unclear

### 4.1 Distribución

| Tipo | Cantidad | Porcentaje |
|---|---|---|
| `ambiguous_interpretation` | 60 | 50.8% |
| `lack_of_evidence` | 58 | 49.2% |

### 4.2 Análisis

**60 casos de interpretación ambigua:** El claim existe y parece relacionado con la política, pero la postura no es clara. Estos requieren revisión humana para determinar si el claim apoya, rechaza o es neutral respecto a la pregunta.

**58 casos de falta de evidencia:** El claim fue asociado a la pregunta pero no parece realmente relacionado con la política concreta. Estos deberían ser **eliminados de la evidencia** de esa pregunta, ya que no son evidencia relevante.

### 4.3 Recomendación

- Los 58 casos de `lack_of_evidence` pueden ser filtrados automáticamente, reduciendo el ruido en la matriz.
- Los 60 casos de `ambiguous_interpretation` requieren revisión humana o clasificación con Jev (SPIKE-12).

## 5. Investigación de ERC en bienestar

### 5.1 Hallazgo principal

ERC tiene **34 claims relacionados con bienestar** dispersos en áreas temáticas diversas. La causa principal de la baja cobertura es que **ERC clasifica muchas propuestas de bienestar bajo "Competencias autonómicas"** en lugar de bajo el área temática del contenido.

### 5.2 Claims bajo "competencias autonómicas" que son bienestar

| Página | Contenido | Área clasificada |
|---|---|---|
| 11 | Exigir competencias exclusivas en materia educativa | Educación / Competencias autonómicas |
| 13 | Plan de Soberanía Cultural para museos | Cultura / Competencias autonómicas |
| 20 | Salario mínimo catalán (SMC) de 1.460€ | Política laboral / Competencias autonómicas |
| 27 | Competencias en formación profesional | Formación Profesional / Competencias autonómicas |
| 32 | Fondos europeos agrarios para Cataluña | Política Agraria / Competencias autonómicas |

### 5.3 Recomendación

Los claims de ERC bajo "Competencias autonómicas" deben **reclasificarse temáticamente** para que las propuestas de bienestar se asocien correctamente con las preguntas de bienestar. Esto mejoraría la cobertura de ERC de 1/8 a aproximadamente 5/8 en Estado de bienestar.

## 6. Revisión de preguntas con un solo partido

### 6.1 Q008 — Protección de inquilinos (Sumar)

**Recomendación:** Mantener la pregunta pero buscar evidencia más específica en otros partidos. La palabra "proteger" es demasiado genérica. Buscar claims sobre "alquiler", "inquilino", "desahucio" en PSOE, PP, Vox y ERC.

### 6.2 Q010 — Reducción del IRPF (PP)

**Recomendación:** Ampliar a 3+ partidos. Vox tiene evidencia clara ("Simplificación y bajada del IRPF") y ERC también ("reduir els tipus de la fiscalitat del treball").

### 6.3 Q013 — Protección de bosques (ERC)

**Recomendación:** Mantener con baja comparabilidad. Es una pregunta válida aunque solo un partido tenga evidencia específica. Los otros partidos pueden tener posturas implícitas en propuestas sobre medio ambiente más generales.

### 6.4 Q023 — Inversión en seguridad (Vox)

**Recomendación:** Buscar evidencia más específica en otros partidos. ERC tiene postura contraria ("derogar la Llei mordassa") que podría clasificarse como `disagrees`.

## 7. Verificación de valores numéricos

**Resultado:** OK. No se asignan valores numéricos a posiciones no aprobadas. Todas las posiciones están en estado `draft` con `approved: false`.

## 8. Estimación del trabajo humano pendiente

| Tarea | Estimación | Prioridad |
|---|---|---|
| Revisar 60 casos `ambiguous_interpretation` | 2-3 horas | Alta |
| Filtrar 58 casos `lack_of_evidence` | 30 min (automático) | Alta |
| Reclasificar claims de ERC bajo "competencias autonómicas" | 1 hora | Media |
| Buscar evidencia adicional para Q008, Q010, Q023 | 1 hora | Media |
| Aprobar posiciones tras revisión | 2-3 horas | Alta |
| **Total estimado** | **6-8 horas** | — |

## 9. Archivos generados

| Archivo | Descripción |
|---|---|
| `complete_matrix.json` | Matriz 23×5 completa con postura, cita literal, página, condiciones y documento |
| `unclear_cases.json` | 118 casos unclear clasificados por tipo |
| `erc_welfare_investigation.json` | 34 claims de ERC relacionados con bienestar |
| `formulation_issues.json` | 4 problemas de formulación detectados |
| `position_summary.json` | Resumen de posiciones a nivel de celda y claim |

## 10. SPIKE-12 — Jev como clasificador auxiliar

### 10.1 Qué es Jev

Jev es un "System One Model" de TypeSafe AI accesible mediante la API directa de TypeSafe (`POST https://api.typesafe.ai/v1/systemone`, modelo `jev-1.14.0`). No genera texto libre: recibe un estado y preguntas tipadas, y devuelve una elección entre opciones fijas con probabilidades calibradas.

### 10.2 Uso potencial

Para los 60 casos de `ambiguous_interpretation`, Jev podría clasificar automáticamente:

**Entrada:** Pregunta neutral + cita literal + condiciones
**Salida:** Clase A (apoyo explícito), Clase B (oposición explícita), Clase C (ambiguo/condicionado), Clase D (no determinable)

### 10.3 Requisitos

- Clave `TYPESAFE_API_KEY` (API directa de TypeSafe, sin OpenRouter). Implementación y estado: `docs/spike-12-jev.md`
- No requiere instalación de paquetes
- Coste estimado: ~$0.01 por clasificación

### 10.4 Benchmark propuesto

1. Seleccionar 100-150 relaciones claim-pregunta incluyendo casos claros, ambiguos, condicionados y contradictorios.
2. Obtener clasificación de referencia revisada por una persona.
3. Comparar Jev frente a Claude con las mismas entradas y etiquetas.
4. Medir precisión por clase, falsos apoyos, falsas oposiciones, capacidad de abstención, latencia y coste.

### 10.5 Recomendación

**Mantener Anthropic → OpenAI para generación y extracción documental.** Añadir Jev únicamente como servicio experimental de clasificación de evidencias, sin capacidad de aprobar o publicar posiciones. Si el benchmark demuestra mejora clara, integrarlo. Si no, descartarlo sin afectar la arquitectura.
