# Pruebas de concepto (Technical Spikes)

**Fecha:** 2026-11-13  
**Especificación:** v1.1  
**Estado:** Propuesta para validación

---

## 1. Introducción

Los spikes son pruebas de concepto enfocadas en los aspectos de mayor riesgo técnico. Cada spike tiene un criterio de éxito claro y un plazo máximo. Si un spike falla, se documentan las alternativas.

---

## 2. Spikes

### SPIKE-01: Extracción de texto de PDFs reales

**Riesgo:** PDFs escaneados, tablas complejas o estructura no lineal generan extracciones de baja calidad.

**Objetivo:** Verificar que `pdfplumber` extrae texto correctamente de PDFs de programas electorales reales.

**Criterio de éxito:**
- Texto extraído coincide con el contenido visual del PDF (>95% de fidelidad) **en al menos 5 PDFs de programas electorales reales**, no solo en PDFs de prueba.
- Páginas identificadas correctamente en todos los casos.
- Secciones detectadas con encabezados en >90% de los casos.
- Tablas preservadas como texto estructurado en >80% de los casos.
- **No se considera validado con menos de 5 documentos reales de fuentes variadas** (gobierno, partidos, instituciones).

**Método:**
1. Seleccionar **al menos 5 PDFs** representativos de fuentes reales: texto nativo, escaneado, con tablas, con estructura compleja, de diferentes instituciones.
2. Ejecutar `pdfplumber` y comparar salida con texto esperado.
3. Medir fidelidad: caracteres coincidentes / total.
4. Documentar casos de fallo y patrones de error.

**Herramientas:** `pdfplumber`, `PyMuPDF` (alternativa).

**Resultado esperado:** `pdfplumber` suficiente para PDFs de texto nativo. `PyMuPDF` mejor para tablas. OCR necesario solo para escaneados.

**Plazo:** 2 días.

---

### SPIKE-02: Trazabilidad de propuestas hasta la fuente

**Riesgo:** Las citas extraídas no son verificables o los localizadores son incorrectos.

**Objetivo:** Verificar que cada propuesta puede trazarse a una página y fragmento del documento original.

**Criterio de éxito:**
- Cada claim tiene `literal_text` que es substring del texto original.
- Página y offset correctos.
- El admin puede navegar desde la propuesta al fragmento original.

**Método:**
1. Extraer propuestas de un PDF de prueba.
2. Verificar que cada `literal_text` existe en el texto extraído.
3. Verificar que el localizador (página, offset) es correcto.
4. Implementar vista de evidencia en admin.

**Resultado esperado:** Trazabilidad completa verificable. Las citas son substring exacto del texto original.

**Plazo:** 2 días.

---

### SPIKE-03: Verificación independiente mediante IA

**Riesgo:** El LLM genera citas falsas o interpretaciones incorrectas.

**Objetivo:** Verificar que un verificador independiente detecta alucinaciones del extractor.

**Criterio de éxito:**
- El verificador detecta >90% de citas falsas inyectadas **en un corpus de al menos 30 propuestas** (no solo 5).
- Falsos positivos <10% **medidos sobre al menos 50 propuestas válidas**.
- El verificador es independiente del extractor (modelo diferente o prompt diferente).
- **No se considera validado con menos de 30 propuestas de prueba**.

**Método:**
1. Extraer propuestas de **al menos 3 documentos reales** con LLM A.
2. Inyectar **al menos 10 citas falsas** de tipos variados: cita inventada, cita de otro documento, cita modificada, cita sacada de contexto.
3. Ejecutar verificador con LLM B (o reglas deterministas).
4. Medir detección de citas falsas y falsos positivos.
5. Documentar patrones de fallo.

**Resultado esperado:** Verificador detecta la mayoría de alucinaciones. Las reglas deterministas (búsqueda de substring) son más fiables que el LLM para verificación.

**Plazo:** 3 días.

---

### SPIKE-04: Identificación de posiciones equivalentes

**Riesgo:** Propuestas equivalentes se registran como duplicadas o se pierden.

**Objetivo:** Verificar que el sistema detecta propuestas equivalentes del mismo documento.

**Criterio de éxito:**
- Detección de duplicados exactos: 100%.
- Detección de duplicados semánticos: >70%.
- Falsos positivos: <15%.

**Método:**
1. Crear corpus de prueba con propuestas duplicadas (exactas y semánticas).
2. Probar detección por:
   - Hash de texto normalizado (exactos).
   - Similitud de texto (Levenshtein, cosine similarity).
   - LLM con prompt de comparación.
3. Medir precisión y recall.

**Resultado esperado:** Hash para exactos, Levenshtein para semánticos simples. LLM opcional para casos complejos.

**Plazo:** 2 días.

---

### SPIKE-05: Generación de preguntas neutrales

**Riesgo:** Las preguntas generadas por IA tienen sesgo o lenguaje cargado.

**Objetivo:** Verificar que se pueden generar preguntas neutrales a partir de propuestas.

**Criterio de éxito:**
- Preguntas generadas pasan checklist de neutralidad (revisión humana).
- Sin lenguaje valorativo, etiquetas cargadas o presupuestos engañosos.
- Una sola idea por pregunta.

**Método:**
1. Generar 20 preguntas a partir de propuestas con LLM.
2. Revisión humana con checklist de neutralidad.
3. Medir porcentaje de preguntas que pasan.

**Resultado esperado:** Las preguntas generadas requieren revisión humana significativa. No se recomienda generación automática sin supervisión para MVP.

**Plazo:** 2 días.

---

### SPIKE-06: Algoritmo de compatibilidad

**Riesgo:** El algoritmo produce resultados engañosos o sesgados.

**Objetivo:** Verificar que el algoritmo de scoring es correcto, determinista y sin sesgos evidentes.

**Criterio de éxito:**
- Resultados idénticos con mismos inputs (determinismo) **verificado con al menos 50 conjuntos de inputs distintos**.
- Invariancia por orden de entidades **probada con todas las permutaciones de 5 entidades**.
- Sin sesgo detectable por selección de preguntas (diferencia <10 pp entre pools) **medido con al menos 4 pools distintos**.
- Casos límite manejados correctamente **incluyendo scoring multidimensional con calibración**.
- **No se considera validado con menos de 50 tests unitarios** cubriendo: coincidencia total, desacuerdo total, sin posiciones, cobertura baja, posiciones condicionadas, posiciones no comparables, entidades sin posiciones evaluables, múltiples dimensiones, pesos variables, calibración seria, calibración rápida, calibración omitida, **renormalización de pesos entre dimensiones evaluables**, **entidad con evidencia en una sola dimensión → 100% si coincide**, **cobertura por dimensión con denominador correcto (preguntas respondidas en esa dimensión)**.

**Método:**
1. Implementar motor de scoring en TypeScript con soporte multidimensional y calibración.
2. Ejecutar suite de pruebas con **al menos 50 tests unitarios**:
   - Coincidencia total → 100%.
   - Desacuerdo total → 0%.
   - Sin posiciones → "Sin datos suficientes".
   - Invariancia por orden (todas las permutaciones de 5 entidades).
   - Reproducibilidad (1000 ejecuciones).
   - Score multidimensional: una dimensión vacía, dos dimensiones con cobertura desigual.
   - Posiciones `explicit_neutral` incluidas vs `not_stated` excluidas.
   - Entidad sin posiciones evaluables entre entidades con posiciones.
   - Calibración rápida: pesos baja/media/alta → normalizados correctamente.
   - Calibración omitida: pesos iguales por defecto.
   - Calibración seria: pesos calibrados aplicados correctamente.
   - **Renormalización:** Entidad con evidencia en 1 de 6 dimensiones y coincidencia 100% → score 100%, no 16.7%.
   - **Renormalización:** Entidad con evidencia en 2 de 6 dimensiones → pesos redistribuidos proporcionalmente.
   - **Cobertura por dimensión:** Denominador = preguntas respondidas en esa dimensión, no total respondidas.
   - **Cobertura por dimensión:** Usuario responde 6 preguntas en 3 dimensiones; entidad con evidencia en 2 → cobertura por dimensión calculada correctamente.
3. Analizar resultados y documentar desviaciones.

**Resultado esperado:** Algoritmo correcto y determinista. Los sesgos se mitigan con cobertura visible y revisión editorial.

**Plazo:** 3 días.

**D-02 confirmada.** El modelo funcional está aprobado.

---

### SPIKE-07: Persistencia local en IndexedDB

**Riesgo:** Los datos locales se pierden o no son recuperables.

**Objetivo:** Verificar que IndexedDB funciona correctamente para guardar y recuperar sesiones de encuesta.

**Criterio de éxito:**
- Datos guardados y recuperados correctamente.
- Persistencia tras recargar la página.
- Borrado funcional (individual y masivo).
- Compatibilidad con navegadores principales (Chrome, Firefox, Safari, Edge).

**Método:**
1. Implementar wrapper de IndexedDB.
2. Tests en navegadores principales.
3. Verificar persistencia tras recarga.
4. Verificar borrado.

**Resultado esperado:** IndexedDB funcional en todos los navegadores principales. Los datos se pierden solo al limpiar almacenamiento del navegador (comportamiento esperado).

**Plazo:** 1 día.

---

### SPIKE-08: Exportación e importación de resultados

**Riesgo:** Los archivos exportados no son importables o se corrompen.

**Objetivo:** Verificar que la exportación e importación reproducen correctamente los resultados.

**Criterio de éxito:**
- Exportación genera JSON válido con esquema versionado.
- Importación valida esquema y hash de integridad.
- Resultados reproducidos idénticamente tras importación.
- Archivos malformados rechazados correctamente.

**Método:**
1. Implementar exportación e importación.
2. Exportar sesión de prueba.
3. Importar en otro navegador/dispositivo.
4. Comparar resultados.
5. Probar con archivos malformados.

**Resultado esperado:** Exportación/importación funcional. Los resultados se reproducen idénticamente.

**Plazo:** 2 días.

---

### SPIKE-09: Comparación de documentos históricos

**Riesgo:** Las comparaciones históricas son engañosas o fuera de contexto.

**Objetivo:** Verificar que el sistema maneja correctamente la comparabilidad histórica.

**Criterio de éxito:**
- Preguntas no comparables excluidas correctamente.
- Contexto histórico visible y claro.
- Sin etiquetas del tipo "eres X% nazi/comunista".
- Cobertura refleja exclusiones.

**Método:**
1. Crear entidad histórica de prueba con posiciones.
2. Marcar preguntas como `not_comparable`.
3. Verificar exclusión del scoring.
4. Verificar UI de contexto histórico.

**Resultado esperado:** Comparaciones históricas manejadas correctamente con contexto visible.

**Plazo:** 2 días.

---

### SPIKE-10: Configuración multilingüe

**Riesgo:** Las traducciones no funcionan o alteran los resultados.

**Objetivo:** Verificar que la arquitectura i18n funciona sin afectar el scoring.

**Criterio de éxito:**
- Textos de interfaz traducidos correctamente.
- Fallback a castellano cuando falta traducción.
- Las traducciones no alteran el scoring para las mismas respuestas.
- Idioma activable/desactivable desde admin.

**Método:**
1. Implementar i18n con castellano y un idioma de prueba (inglés).
2. Traducir textos de interfaz.
3. Verificar que scoring es idéntico en ambos idiomas.
4. Verificar fallback.

**Resultado esperado:** i18n funcional. El scoring es independiente del idioma.

**Plazo:** 2 días.

---

### SPIKE-11: Algoritmo de calibración de prioridades

**Riesgo:** El algoritmo de comparaciones por pares no produce pesos estables, deterministas o reproducibles.

**Objetivo:** Verificar que el algoritmo de calibración seria produce pesos positivos normalizados, deterministas y reproducibles.

**Criterio de éxito:**
- **Determinismo:** Mismas respuestas → mismos pesos verificado con al menos 50 conjuntos de respuestas distintos.
- **Estabilidad:** Pequeños cambios en las respuestas producen pequeños cambios en los pesos (sensibilidad acotada).
- **Cobertura de dimensiones:** Todas las dimensiones con al menos una pregunta evaluable reciben un peso positivo.
- **Empates:** Dos dimensiones declaradas equivalentes reciben pesos iguales (diferencia < 0.01).
- **Omisiones:** Las dimensiones no comparadas reciben peso proporcional al resto.
- **Reproducibilidad entre sesiones:** Los pesos guardados en la exportación se reproducen idénticamente al importar.
- **Selección adaptativa:** El algoritmo elige comparaciones informativas, no aleatorias.
- **No se considera validado con menos de 50 tests unitarios** cubriendo: determinismo, estabilidad, empates, omisiones, reproducibilidad, cobertura completa, dimensiones vacías.

**Método:**
1. Implementar algoritmo de comparaciones por pares en TypeScript.
2. Ejecutar suite de pruebas con al menos 50 tests unitarios:
   - Determinismo: 50 conjuntos de respuestas idénticos → pesos idénticos.
   - Estabilidad: variar una respuesta → medir cambio en pesos.
   - Empates: declarar todas equivalentes → pesos iguales.
   - Omisiones: omitir 50% de comparaciones → pesos válidos.
   - Reproducibilidad: exportar/importar → pesos idénticos.
   - Cobertura: todas las dimensiones reciben peso > 0.
   - Dimensiones vacías: no se incluyen en calibración.
3. Analizar resultados y documentar desviaciones.

**Resultado esperado:** Algoritmo correcto, determinista y reproducible. Los pesos son estables ante pequeñas variaciones.

**Plazo:** 3 días.

**D-02 confirmada.** El modelo funcional (media ponderada con tres modos de calibración) está aprobado. Este spike valida el algoritmo matemático específico del modo serio.

---

## 3. Resumen de spikes

| Spike | Riesgo | Plazo | Dependencias |
|---|---|---|---|
| SPIKE-01: Extracción PDF | Alta | 2 días | Ninguna |
| SPIKE-02: Trazabilidad | Alta | 2 días | SPIKE-01 |
| SPIKE-03: Verificación IA | Alta | 3 días | SPIKE-01 |
| SPIKE-04: Equivalencias | Media | 2 días | SPIKE-01 |
| SPIKE-05: Preguntas neutrales | Media | 2 días | Ninguna |
| SPIKE-06: Algoritmo scoring | Alta | 3 días | Ninguna |
| SPIKE-07: IndexedDB | Baja | 1 día | Ninguna |
| SPIKE-08: Export/Import | Media | 2 días | SPIKE-07 |
| SPIKE-09: Históricos | Media | 2 días | SPIKE-06 |
| SPIKE-10: i18n | Baja | 2 días | Ninguna |
| SPIKE-11: Calibración prioridades | Alta | 3 días | Ninguna |

**Prioridad:** SPIKE-01, SPIKE-06, SPIKE-11, SPIKE-03 son los más críticos. Ejecutar primero.

---

## 4. Qué puede comprobarse automáticamente vs. revisión humana

| Spike | Automático | Revisión humana |
|---|---|---|
| SPIKE-01: Extracción PDF | Comparación de texto con esperado | Revisión visual de calidad |
| SPIKE-02: Trazabilidad | Búsqueda de substring en texto original | Verificación de contexto |
| SPIKE-03: Verificación IA | Métricas de detección de citas falsas | Revisión de falsos positivos |
| SPIKE-04: Equivalencias | Métricas de precisión/recall | Revisión de casos borderline |
| SPIKE-05: Preguntas neutrales | — | Checklist de neutralidad |
| SPIKE-06: Algoritmo scoring | Suite de pruebas unitarias | Revisión de casos límite |
| SPIKE-07: IndexedDB | Tests en navegadores | — |
| SPIKE-08: Export/Import | Comparación de resultados | Revisión de esquema JSON |
| SPIKE-09: Históricos | Exclusión del scoring | Revisión de contexto |
| SPIKE-10: i18n | Scoring idéntico en idiomas | Revisión de traducciones |
| SPIKE-11: Calibración prioridades | Suite de pruebas unitarias | Revisión de estabilidad y sensibilidad |
