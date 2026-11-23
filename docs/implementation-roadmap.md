# Plan de implementación por hitos

**Fecha:** 2026-11-13  
**Especificación:** v1.1  
**Estado:** Propuesta para validación

---

## 1. Resumen de hitos

| Hito | Alcance | Duración estimada | Dependencias |
|---|---|---|---|
| H0 — Fundamentos | Repositorio, Docker, BD, estructura base, i18n, upload | 1-2 semanas | Ninguna (auth admin es parte de H0, no bloquea el resto de H0) |
| H1 — Documentos | Upload, parser PDF, fuentes, pipeline IA básico | 2-3 semanas | H0 (BD y storage) |
| H2 — Banco de preguntas | Preguntas, posiciones, taxonomía, matriz de cobertura | 2-3 semanas | H0 (BD) |
| H3 — Frontend público | Catálogo, encuesta, historial local, exportación | 2-3 semanas | H2 (necesita releases) |
| H4 — Motor de scoring | Cálculo multidimensional, resultados, cobertura, evidencias | 2-3 semanas | H2 (necesita posiciones con dimensiones) |
| H5 — Históricos | Referencias históricas, comparabilidad, contexto | 1-2 semanas | H4 |
| H6 — Lanzamiento | Hardening, E2E, legal, despliegue | 2-3 semanas | H0-H5 |

**Total estimado:** 10-16 semanas para MVP completo.

**Nota sobre paralelismo:** H1 y H2 pueden desarrollarse en paralelo tras H0. H3 y H4 pueden desarrollarse en paralelo tras H2.

---

## 2. H0 — Fundamentos

### Objetivo
Infraestructura base funcional: repositorio, Docker Compose, PostgreSQL, estructura de Nuxt, i18n, autenticación admin.

### Tareas

#### H0-1: Configuración del repositorio
- Crear estructura de directorios según `architecture.md`.
- `package.json` con dependencias base: Nuxt 3, Vue, TypeScript, Pinia.
- `docker-compose.yml` con servicios web y db.
- `Dockerfile.web` para Nuxt.
- `.gitignore`, `.env.example`.

**Criterio de aceptación:** `docker compose up` levanta web y BD sin errores.

#### H0-2: Base de datos y migraciones
- Crear migraciones SQL iniciales según `data-model.md`.
- Script de seed con dimensiones y temas base.
- Conexión BD desde Nuxt con `pg` (node-postgres) + `node-pg-migrate` para migraciones.
- Pool de conexiones compartido en `server/utils/db.ts`.
- **Sin ORM:** consultas SQL parametrizadas directamente.

**Criterio de aceptación:** Migraciones ejecutadas, tablas creadas, datos de seed cargados. Consultas parametrizadas sin interpolación de strings.

#### H0-3: Estructura de Nuxt
- Configurar Nuxt con TypeScript.
- Configurar `@nuxtjs/i18n` con castellano por defecto.
- Crear estructura de páginas: `/`, `/survey/[slug]`, `/admin/*`.
- Configurar Pinia para stores.

**Criterio de aceptación:** App Nuxt arranca, páginas base renderizan, i18n funciona.

#### H0-4: Autenticación admin
- Implementar OTP por email con Brevo.
- Tablas `admin_credentials`, `admin_sessions`.
- Endpoints: solicitar OTP, verificar OTP, logout.
- Protección de rutas `/admin/*`.
- Caducidad 10 minutos, límite de intentos, bloqueo temporal.

**Criterio de aceptación:** Admin puede solicitar código OTP, recibirlo por email, iniciar sesión, acceder a `/admin`, y cerrar sesión. Rutas admin protegidas.

**Nota:** D-01 confirmada. Esta tarea puede comenzar sin bloqueos.

#### H0-5: Almacenamiento de documentos
- Crear directorio `./storage/` con permisos correctos.
- Endpoint de upload básico con validación MIME y tamaño.
- Almacenamiento en disco con path seguro.

**Criterio de aceptación:** Upload de PDF funciona, archivo almacenado fuera de directorio público, hash SHA-256 registrado.

### Definition of Done de H0
- [ ] `docker compose up` levanta todo.
- [ ] Migraciones ejecutadas y datos de seed cargados.
- [ ] App Nuxt arranca con i18n.
- [ ] Admin puede autenticarse.
- [ ] Upload de PDF funciona.
- [ ] Sin vulnerabilidades conocidas en dependencias.

---

## 3. H1 — Documentos

### Objetivo
Pipeline documental funcional: upload, extracción de texto, segmentación, extracción de propuestas con LLM, verificación, cola de revisión.

### Tareas

#### H1-1: Modelo de fuentes
- CRUD de fuentes en admin: crear, listar, ver detalle, eliminar.
- Metadatos: título, tipo, URL, hash, idioma, año, licencia.
- Estados: `uploaded → parsed → reviewed → accepted | rejected`.

**Criterio de aceptación:** Admin puede gestionar fuentes con todos los metadatos.

#### H1-2: Worker de extracción
- Script Python: `extract.py` con `pdfplumber`.
- Extracción de texto por página.
- Segmentación por secciones/párrafos.
- Guardado en `source_passages`.

**Criterio de aceptación:** PDF procesado, texto extraído, segmentos guardados en BD con localizadores.

#### H1-3: Extracción con LLM
- Configuración de proveedor LLM (config.yaml).
- Prompt template para extracción de propuestas.
- Validación de salida JSON.
- Guardado en `claims` con estado `draft`.

**Criterio de aceptación:** Propuestas extraídas, validadas por esquema, guardadas en BD.

#### H1-4: Verificación
- Script Python: `verify.py`.
- Validación de citas contra texto original.
- Detección de duplicados y contradicciones.
- Actualización de estados: `machine_checked → needs_review | ready_for_batch`.

**Criterio de aceptación:** Propuestas verificadas, incidencias marcadas, cola de revisión poblada.

#### H1-5: Panel de revisión
- UI de cola de revisión en admin.
- Vista de propuesta con cita, contexto y estado.
- Aprobación por lotes: seleccionar múltiples, aprobar.
- Revisión individual: aceptar, modificar, rechazar.
- Registro en `editorial_audit`.

**Criterio de aceptación:** Admin puede revisar, aprobar y rechazar propuestas con auditoría completa.

### Definition of Done de H1
- [ ] Dos PDFs diferentes procesados con citas recuperables.
- [ ] Propuestas extraídas y verificadas.
- [ ] Cola de revisión funcional con aprobación por lotes.
- [ ] Auditoría de todas las acciones editoriales.

---

## 4. H2 — Banco de preguntas

### Objetivo
Banco de preguntas revisadas, taxonomía, posiciones entidad-pregunta, matriz de cobertura.

### Tareas

#### H2-1: Taxonomía
- UI de gestión de temas y dimensiones en admin.
- Jerarquía: dimensiones → temas.
- CRUD completo.

**Criterio de aceptación:** Taxonomía configurable desde admin.

#### H2-2: Banco de preguntas
- CRUD de preguntas en admin.
- Campos: texto canónico, tema, nivel de profundidad, tipo de respuesta, opciones.
- Validación de neutralidad (checklist editorial).
- Estados: `draft → reviewed → published`.

**Criterio de aceptación:** Preguntas creadas, validadas y publicadas.

#### H2-3: Posiciones
- UI de asignación de posiciones: entidad + pregunta + valor + evidencia.
- Vinculación con claims aprobados.
- Estados: `draft → approved | rejected`.
- Soporte para `unknown`, `not_stated`, `not_comparable`, `conditional`.

**Criterio de aceptación:** Posiciones asignadas con evidencia, estados correctos.

#### H2-4: Matriz de cobertura
- Vista de matriz entidad × pregunta en admin.
- Visualización de cobertura: posiciones aprobadas, pendientes, desconocidas.
- Filtros por entidad, tema, dimensión.

**Criterio de aceptación:** Matriz muestra cobertura completa, detecta ausencias.

### Definition of Done de H2
- [ ] Preguntas validadas sin posiciones inventadas.
- [ ] Matriz de cobertura funcional.
- [ ] Posiciones vinculadas con evidencia.

---

## 5. H3 — Frontend público

### Objetivo
Catálogo público, flujo de encuesta, historial local en IndexedDB, exportación/importación.

### Tareas

#### H3-1: Catálogo de encuestas
- Página principal con lista de encuestas publicadas.
- Filtros por categoría.
- Detalle de encuesta: título, descripción, entidades, fuentes.

**Criterio de aceptación:** Visitante puede ver y filtrar encuestas publicadas.

#### H3-2: Flujo de encuesta
- Selección de entidades (actuales + históricos opcionales).
- Selección de modalidad (rápida/normal/profunda).
- Renderizado de preguntas con opciones de respuesta.
- Asignación de importancia por pregunta.
- Navegación: siguiente, anterior, revisión.

**Criterio de aceptación:** Visitante puede completar una encuesta sin enviar datos al servidor.

#### H3-3: Historial local
- IndexedDB: guardado automático de progreso.
- Página "Mis encuestas": lista de resultados locales.
- Borrado individual y masivo.
- Aviso de pérdida de datos locales.

**Criterio de aceptación:** Progreso guardado localmente, recuperable, borrable.

#### H3-4: Exportación/importación
- Exportación a JSON versionado.
- Importación con validación de esquema.
- Verificación de integridad (hash).
- Rechazo de archivos malformados.

**Criterio de aceptación:** Exportación e importación reproducen respuestas y resultados.

### Definition of Done de H3
- [ ] Flujo anónimo completo de principio a fin.
- [ ] Ninguna respuesta enviada al servidor (verificado con test de red).
- [ ] Historial local funcional.
- [ ] Exportación/importación validada.

---

## 6. H4 — Motor de scoring

### Objetivo
Cálculo de compatibilidad, resultados explicables, cobertura, evidencias.

### Tareas

#### H4-1: Motor de scoring multidimensional
- Implementación en TypeScript según `scoring-methodology.md`.
- Función pura: `calculateScoring(answers, positions, weights, entities, dimensionNames, calibration?) → results[]`.
- Soporte para: dimensiones, evidencias, cobertura por dimensión, entidades sin posiciones evaluables.
- **Soporte para calibración de prioridades con tres modos** (seria, rápida, omitida).
- Fórmula global: `C_p = 100 × Σ λ_d × avg_s_{pd}` (media ponderada de dimensiones).
- Pruebas unitarias: **mínimo 50 tests** cubriendo casos base, límites, invariancia, multidimensional, posiciones condicionadas, no comparables, explicit_neutral vs not_stated, calibración.

**Criterio de aceptación:** Motor calcula correctamente en modo multidimensional, ≥50 pruebas pasan, determinista, invariante por orden de entidades. D-02 confirmada.

#### H4-2: Resultados por entidad y dimensión
- Vista de resultados: porcentaje de coincidencia global por entidad.
- **Desglose por dimensión obligatorio:** cada dimensión con al menos una pregunta evaluable muestra su score, cobertura y número de preguntas.
- Cobertura visible: `n_evaluable`, `n_respondidas`, `coverage_percent`, `dimensionsWithCoverage`, `totalDimensions`.
- Advertencia **informativa** si cobertura < 20% o menos de 3 dimensiones con cobertura (nunca se oculta el resultado).
- "Sin datos suficientes" si no hay dimensiones con preguntas evaluables.

**Criterio de aceptación:** Resultados explicables con cobertura global, por dimensión, y advertencias apropiadas.

#### H4-3: Evidencias
- Enlace desde resultado a evidencia documental.
- Vista de detalle: cita, página, fuente, contexto.
- Diferenciación de coincidencias y desacuerdos.

**Criterio de aceptación:** Cada posición es trazable a fuente primaria.

#### H4-4: Pruebas de scoring
- Tests de invariancia por orden de entidades.
- Tests de reproducibilidad.
- Tests de casos límite: sin datos, cobertura baja, todos omitidos.
- Tests de sensibilidad: pools distintos, pesos variables.

**Criterio de aceptación:** Todos los tests pasan, sin sesgos detectados.

### Definition of Done de H4
- [ ] Motor de scoring probado y determinista.
- [ ] Resultados explicables con cobertura y evidencias.
- [ ] Tests de invariancia y reproducibilidad aprobados.

---

## 7. H5 — Históricos

### Objetivo
Incorporación de referencias históricas con comparabilidad y contexto.

### Tareas

#### H5-1: Entidades históricas
- Soporte para `is_historical` y `period_label`.
- Etiquetado visible: país, año, tipo de documento.
- Selección opcional en flujo de encuesta.

**Criterio de aceptación:** Históricos visibles y seleccionables con contexto claro.

#### H5-2: Comparabilidad
- Estado `not_comparable` por dimensión.
- Exclusión de preguntas no comparables del scoring.
- Indicador visual: "Esta pregunta no es comparable con [entidad]".

**Criterio de aceptación:** Preguntas no comparables excluidas correctamente.

#### H5-3: Contexto histórico
- Texto explicativo de diferencias estructurales.
- Advertencias de comparabilidad limitada.
- Sin etiquetas del tipo "eres X% nazi/comunista".

**Criterio de aceptación:** Contexto histórico visible, sin malinterpretaciones.

### Definition of Done de H5
- [ ] Históricos incorporados con comparabilidad y contexto.
- [ ] Resultados históricos explicados correctamente.

---

## 8. H6 — Lanzamiento

### Objetivo
Hardening, pruebas E2E, revisión legal, despliegue en producción.

### Tareas

#### H6-1: Hardening de seguridad
- Revisión de headers de seguridad.
- Rate limiting verificado.
- Validación de uploads con archivos maliciosos.
- Revisión de dependencias: sin vulnerabilidades.
- Secrets management verificado.

**Criterio de aceptación:** Checklist de seguridad completado.

#### H6-2: Pruebas E2E
- Flujo completo de visitante anónimo.
- Verificación de red: sin respuestas enviadas al servidor.
- Flujo completo de admin: upload → extracción → revisión → publicación.
- Exportación/importación end-to-end.
- Historial local: guardado, recuperación, borrado.

**Criterio de aceptación:** Todos los flujos E2E pasan.

#### H6-3: Revisión legal
- Textos de aviso legal, privacidad, cookies, términos.
- Revisión de tratamiento de datos políticos.
- Verificación de derechos de documentos.

**Criterio de aceptación:** Textos legales publicados, revisión completada.

#### H6-4: Despliegue
- Configuración de VPS: TLS, firewall, backups.
- Despliegue con Docker Compose.
- Backup y restauración probados.
- Monitoreo básico: logs, errores.

**Criterio de aceptación:** Plataforma en producción, accesible, segura, con backups.

### Definition of Done de H6
- [ ] Checklist de seguridad completado.
- [ ] Pruebas E2E aprobadas.
- [ ] Textos legales publicados.
- [ ] Despliegue en producción verificado.
- [ ] Backup y restauración probados.

---

## 9. Dependencias entre hitos

```mermaid
graph LR
  H0[H0: Fundamentos] --> H1[H1: Documentos]
  H0 --> H2[H2: Banco]
  H1 -.paralelo. H2
  H2 --> H3[H3: Público]
  H2 --> H4[H4: Scoring]
  H3 -.paralelo. H4
  H4 --> H5[H5: Históricos]
  H0 --> H6[H6: Lanzamiento]
  H1 --> H6
  H2 --> H6
  H3 --> H6
  H4 --> H6
  H5 --> H6
```

**Nota:** H1 y H2 pueden desarrollarse en paralelo tras H0. H3 y H4 pueden desarrollarse en paralelo tras H2. H5 depende de H4. H6 integra todo.

---

## 10. Tareas que pueden comenzar sin decisiones pendientes

Las siguientes tareas **no dependen** de ninguna decisión pendiente y pueden iniciarse inmediatamente:

| Tarea | Hito | Bloqueada por |
|---|---|---|
| H0-1: Configuración del repositorio | H0 | Ninguna |
| H0-2: Base de datos y migraciones | H0 | Ninguna |
| H0-3: Estructura de Nuxt | H0 | Ninguna |
| H0-4: Autenticación admin | H0 | Ninguna (D-01 confirmada) |
| H0-5: Almacenamiento de documentos | H0 | Ninguna |
| SPIKE-06: Algoritmo de scoring | Spikes | Ninguna |
| SPIKE-07: IndexedDB | Spikes | Ninguna |
| SPIKE-10: i18n | Spikes | Ninguna |
| SPIKE-11: Calibración de prioridades | Spikes | Ninguna |

Las siguientes tareas **sí dependen** de decisiones pendientes:

| Tarea | Hito | Bloqueada por |
|---|---|---|
| H1-3: Extracción con LLM | H1 | D-04 (configuración de LLM) |
| H3-4: Exportación/importación | H3 | D-03 (esquema de exportación) |

---

## 11. Decisiones pendientes

| Decisión | Tareas afectadas | Prioridad |
|---|---|---|
| D-03: Esquema de exportación/importación | H3-4 | Media |
| D-04: Configuración de LLM | H1-3 | Media |
| D-06: Umbral de advertencia de cobertura | H4-2 | Media |
