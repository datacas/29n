# Backlog técnico con criterios de aceptación

**Fecha:** 2026-11-13  
**Especificación:** v1.1  
**Estado:** Propuesta para validación

---

## 1. Épicas

| ID | Épica | Hito | Prioridad |
|---|---|---|---|
| EP-01 | Fundamentos del proyecto | H0 | Crítica |
| EP-02 | Autenticación administrativa | H0 | Crítica |
| EP-03 | Gestión documental | H1 | Alta |
| EP-04 | Pipeline de IA | H1 | Alta |
| EP-05 | Revisión editorial | H1 | Alta |
| EP-06 | Banco de preguntas | H2 | Alta |
| EP-07 | Posiciones y evidencia | H2 | Alta |
| EP-08 | Catálogo público | H3 | Alta |
| EP-09 | Flujo de encuesta | H3 | Alta |
| EP-10 | Historial local | H3 | Alta |
| EP-11 | Exportación/importación | H3 | Media |
| EP-12 | Motor de scoring | H4 | Crítica |
| EP-13 | Resultados y evidencias | H4 | Alta |
| EP-14 | Referencias históricas | H5 | Media |
| EP-15 | Hardening y lanzamiento | H6 | Crítica |

---

## 2. Historias de usuario y tareas técnicas

### EP-01: Fundamentos del proyecto

#### SYS-01: Crear estructura del repositorio
**Como** desarrollador, **quiero** una estructura de proyecto configurada **para** comenzar el desarrollo.

**Criterios de aceptación:**
- [ ] Directorio `apps/web/` con Nuxt 3 configurado.
- [ ] Directorio `services/document-worker/` con estructura Python.
- [ ] Directorio `db/migrations/` vacío.
- [ ] `docker-compose.yml` con servicios web y db.
- [ ] `Dockerfile.web` para Nuxt.
- [ ] `.gitignore` con entradas apropiadas.
- [ ] `.env.example` con variables documentadas.

#### SYS-02: Configurar Docker Compose
**Como** desarrollador, **quiero** levantar el entorno con un comando **para** desarrollo local.

**Criterios de aceptación:**
- [ ] `docker compose up` levanta web, db.
- [ ] PostgreSQL accesible desde web.
- [ ] Volúmenes configurados para persistencia.
- [ ] Variables de entorno inyectadas.

#### SYS-03: Configurar base de datos y migraciones
**Como** desarrollador, **quiero** migraciones SQL versionadas **para** reproducir el esquema de BD.

**Criterios de aceptación:**
- [ ] Migraciones SQL para todas las tablas del MVP.
- [ ] Script de seed con dimensiones y temas base.
- [ ] Migraciones ejecutadas automáticamente al iniciar BD.
- [ ] Esquema verificable con `\dt` en psql.

#### SYS-04: Configurar i18n
**Como** desarrollador, **quiero** infraestructura de internacionalización **para** soportar múltiples idiomas.

**Criterios de aceptación:**
- [ ] `@nuxtjs/i18n` configurado.
- [ ] Idioma por defecto: `es-ES`.
- [ ] Archivo `es.json` con textos base de interfaz.
- [ ] Fallback a castellano cuando falta traducción.
- [ ] Selector de idioma en UI (inicialmente solo castellano).

---

### EP-02: Autenticación administrativa

#### ADM-01: Implementar autenticación admin
**Como** administrador, **quiero** acceder de forma segura al panel **para** gestionar contenido.

**Criterios de aceptación:**
- [ ] OTP por email con Brevo implementado.
- [ ] Tablas `admin_credentials`, `admin_sessions` creadas.
- [ ] Endpoint de solicitud de OTP funcional.
- [ ] Endpoint de verificación de OTP funcional.
- [ ] Endpoint de logout funcional.
- [ ] Sesión con cookie HttpOnly, Secure, SameSite.
- [ ] Rotación de sesión cada 24 horas.
- [ ] Rate limiting: 5 intentos → bloqueo 15 min.
- [ ] Caducidad OTP: 10 minutos.
- [ ] Códigos de un solo uso.

**D-01 confirmada.** Esta tarea puede comenzar sin bloqueos.

#### ADM-02: Proteger rutas admin
**Como** desarrollador, **quiero** que las rutas `/admin/*` estén protegidas **para** evitar acceso no autorizado.

**Criterios de aceptación:**
- [ ] Middleware de autenticación en rutas admin.
- [ ] Redirección a login si no autenticado.
- [ ] Endpoints API admin verifican sesión.
- [ ] Sin datos expuestos en respuestas de API pública.

---

### EP-03: Gestión documental

#### DOC-01: Upload de documentos
**Como** administrador, **quiero** subir documentos PDF **para** procesar programas electorales.

**Criterios de aceptación:**
- [ ] Endpoint `POST /api/admin/sources` funcional.
- [ ] Validación MIME real (magic bytes).
- [ ] Tamaño máximo: 50 MB.
- [ ] Nombre de archivo sanitizado.
- [ ] Almacenamiento en `./storage/` fuera de directorio público.
- [ ] Hash SHA-256 calculado y registrado.
- [ ] Detección de duplicados por hash.
- [ ] Metadatos registrados: título, tipo, URL, idioma, año.

#### DOC-02: CRUD de fuentes en admin
**Como** administrador, **quiero** gestionar fuentes **para** mantener el catálogo de documentos.

**Criterios de aceptación:**
- [ ] Listar fuentes con filtros y búsqueda.
- [ ] Ver detalle de fuente con metadatos completos.
- [ ] Editar metadatos de fuente.
- [ ] Eliminar fuente (con confirmación).
- [ ] Estados visibles: `uploaded`, `parsed`, `reviewed`, `accepted`, `rejected`.

---

### EP-04: Pipeline de IA

#### DOC-03: Extracción de texto
**Como** administrador, **quiero** extraer texto de PDFs **para** obtener contenido procesable.

**Criterios de aceptación:**
- [ ] Script `extract.py` funcional con `pdfplumber`.
- [ ] Texto extraído por página con localizadores.
- [ ] Segmentación por secciones/párrafos.
- [ ] Guardado en `source_passages`.
- [ ] Estado de fuente actualizado a `parsed`.

#### DOC-04: Extracción de propuestas con LLM
**Como** administrador, **quiero** extraer propuestas automáticamente **para** acelerar el análisis.

**Criterios de aceptación:**
- [ ] Configuración de proveedor LLM funcional.
- [ ] Prompt template para extracción.
- [ ] Validación de salida JSON.
- [ ] Propuestas guardadas en `claims` con estado `draft`.
- [ ] Registro de prompt_version, modelo y proveedor.

#### DOC-05: Verificación de propuestas
**Como** administrador, **quiero** verificar propuestas automáticamente **para** detectar errores.

**Criterios de aceptación:**
- [ ] Validación de citas contra texto original.
- [ ] Detección de duplicados.
- [ ] Detección de contradicciones aparentes.
- [ ] Estados actualizados: `machine_checked → needs_review | ready_for_batch`.
- [ ] Incidencias registradas.

---

### EP-05: Revisión editorial

#### DOC-06: Cola de revisión
**Como** administrador, **quiero** una cola de propuestas pendientes **para** revisar y aprobar.

**Criterios de aceptación:**
- [ ] Vista de cola con filtros por estado.
- [ ] Detalle de propuesta: cita, contexto, estado, tema sugerido.
- [ ] Acciones: aceptar, modificar, rechazar, marcar no comparable.
- [ ] Registro en `editorial_audit`.

#### DOC-07: Aprobación por lotes
**Como** administrador, **quiero** aprobar múltiples propuestas a la vez **para** acelerar el proceso.

**Criterios de aceptación:**
- [ ] Selección múltiple de propuestas.
- [ ] Endpoint `POST /api/admin/approvals/batch`.
- [ ] Todas las propuestas cambian a `approved`.
- [ ] Auditoría registra IDs exactos y admin.

---

### EP-06: Banco de preguntas

#### QST-01: Gestión de taxonomía
**Como** administrador, **quiero** gestionar temas y dimensiones **para** organizar preguntas.

**Criterios de aceptación:**
- [ ] CRUD de dimensiones.
- [ ] CRUD de temas con asignación a dimensión.
- [ ] Jerarquía visible: dimensiones → temas.

#### QST-02: CRUD de preguntas
**Como** administrador, **quiero** crear y gestionar preguntas **para** poblar el banco.

**Criterios de aceptación:**
- [ ] Crear pregunta con texto canónico, tema, nivel de profundidad, tipo de respuesta.
- [ ] Editar pregunta.
- [ ] Eliminar pregunta (con verificación de uso).
- [ ] Estados: `draft → reviewed → published`.
- [ ] Validación de neutralidad (checklist editorial en UI).

#### QST-03: Pools de preguntas por modalidad
**Como** administrador, **quiero** definir pools de preguntas **para** modalidades rápida/normal/profunda.

**Criterios de aceptación:**
- [ ] Asignar preguntas a pools: rápida (~15), normal (~40), profunda (~100).
- [ ] Ver composición de cada pool.
- [ ] Validación: pregunta puede estar en múltiples pools.

---

### EP-07: Posiciones y evidencia

#### QST-04: Asignación de posiciones
**Como** administrador, **quiero** asignar posiciones a entidades **para** vincular evidencia con preguntas.

**Criterios de aceptación:**
- [ ] UI de asignación: entidad + pregunta + valor + evidencia (claim_id).
- [ ] Vinculación con claims aprobados (`claim_id` en `positions`).
- [ ] Estados separados: `review_status` (draft, approved, rejected) y `stance_status` (explicit_neutral, ambiguous, not_stated, not_comparable, conflicting_sources, conditional).
- [ ] **Distinción obligatoria:** `explicit_neutral` (valor 0, incluida en scoring) ≠ `not_stated` (excluida).
- [ ] Condiciones visibles y editables.
- [ ] Motivo de no comparabilidad editable (`not_comparable_reason`).

#### QST-05: Matriz de cobertura
**Como** administrador, **quiero** ver la matriz de cobertura **para** detectar ausencias.

**Criterios de aceptación:**
- [ ] Matriz entidad × pregunta.
- [ ] Colores por estado: aprobada, pendiente, desconocida, no comparable.
- [ ] Filtros por entidad, tema, dimensión.
- [ ] Resumen de cobertura por entidad.

---

### EP-08: Catálogo público

#### PUB-01: Página de catálogo
**Como** visitante, **quiero** ver las encuestas disponibles **para** elegir una.

**Criterios de aceptación:**
- [ ] Lista de encuestas publicadas con título, descripción, categoría.
- [ ] Filtros por categoría.
- [ ] Detalle de encuesta: entidades, fuentes, modalidades.
- [ ] Solo encuestas con estado `published` visibles.

---

### EP-09: Flujo de encuesta

#### PUB-02: Selección de configuración
**Como** visitante, **quiero** seleccionar entidades y modalidad **para** personalizar mi encuesta.

**Criterios de aceptación:**
- [ ] Selección de entidades actuales (múltiple).
- [ ] Selección opcional de históricos.
- [ ] Selección de modalidad: rápida/normal/profunda.
- [ ] Resumen de configuración antes de comenzar.

#### PUB-03: Responder preguntas
**Como** visitante, **quiero** responder preguntas **para** completar la encuesta.

**Criterios de aceptación:**
- [ ] Renderizado de preguntas con opciones de respuesta.
- [ ] Escala de 5 niveles + "no sé / omitir".
- [ ] Asignación de importancia: baja/media/alta.
- [ ] Navegación: siguiente, anterior.
- [ ] Progreso visible: X de Y preguntas.
- [ ] Guardado automático en IndexedDB.

#### PUB-04: Revisión de respuestas
**Como** visitante, **quiero** revisar mis respuestas **para** corregir antes de ver resultados.

**Criterios de aceptación:**
- [ ] Vista de todas las respuestas con posibilidad de editar.
- [ ] Resumen de importancia asignada.
- [ ] Botón "Calcular resultados".

---

### EP-10: Historial local

#### PUB-05: Guardado en IndexedDB
**Como** visitante, **quiero** que mi progreso se guarde **para** continuar después.

**Criterios de aceptación:**
- [ ] IndexedDB configurado: `affinity-survey-local`.
- [ ] Guardado automático de respuestas y pesos.
- [ ] Recuperación al recargar la página.
- [ ] Aviso de pérdida de datos locales.

#### PUB-06: Gestión de historial
**Como** visitante, **quiero** gestionar mis encuestas completadas **para** revisarlas o borrarlas.

**Criterios de aceptación:**
- [ ] Página "Mis encuestas" con lista de resultados locales.
- [ ] Fecha, versión y entidad visible.
- [ ] Borrado individual.
- [ ] Borrado masivo con confirmación.

---

### EP-11: Exportación/importación

#### PUB-07: Exportación a JSON
**Como** visitante, **quiero** exportar mis resultados **para** conservarlos.

**Criterios de aceptación:**
- [ ] Botón "Exportar" en resultados.
- [ ] Archivo JSON con esquema versionado.
- [ ] Contenido: respuestas, pesos, entidades, release_id, scoring_model, timestamp, hash.
- [ ] Nombre de archivo: `affinity-results-{date}.json`.

#### PUB-08: Importación desde JSON
**Como** visitante, **quiero** importar resultados exportados **para** recuperar mis datos.

**Criterios de aceptación:**
- [ ] Botón "Importar" en página de historial.
- [ ] Validación de esquema JSON.
- [ ] Verificación de `survey_release_id` en servidor.
- [ ] Verificación de hash de integridad.
- [ ] Rechazo de archivos malformados o excesivos (>10 MB).
- [ ] Confirmación de importación exitosa.

---

### EP-12: Motor de scoring

#### SCR-01: Implementar motor de scoring multidimensional
**Como** desarrollador, **quiero** un motor de scoring determinista y multidimensional **para** calcular compatibilidad.

**Criterios de aceptación:**
- [ ] Función `calculateScoring(answers, positions, weights, entities, dimensionNames, calibration?) → results[]`.
- [ ] Fórmula por pregunta: `s_{ip} = 1 - |u_i - v_{ip}| / 4`.
- [ ] Fórmula por dimensión: media ponderada de proximidades.
- [ ] Fórmula global: `C_p = 100 × Σ λ_d × avg_s_{pd}` (media ponderada de dimensiones).
- [ ] Peso por importancia: baja=0.5, media=1.0, alta=2.0.
- [ ] Exclusión de preguntas con estados no evaluables de numerador y denominador.
- [ ] `explicit_neutral` incluida con valor 0; `not_stated` excluida.
- [ ] "Sin datos suficientes" si no hay dimensiones con preguntas evaluables.
- [ ] Porcentajes independientes por entidad.
- [ ] Resultado incluye: score global, score por dimensión, cobertura global, cobertura por dimensión, evidencias, `dimensionsWithCoverage`, `totalDimensions`.
- [ ] Soporte para calibración de prioridades con tres modos (seria, rápida, omitida).
- [ ] **Mínimo 50 pruebas unitarias** cubriendo: casos base, límites, invariancia, multidimensional, posiciones condicionadas, no comparables, explicit_neutral vs not_stated, entidades sin posiciones evaluables, calibración.

**D-02 confirmada.** El modelo funcional está aprobado.

#### SCR-02: Pruebas de scoring
**Como** desarrollador, **quiero** pruebas exhaustivas **para** garantizar corrección.

**Criterios de aceptación:**
- [ ] Test: coincidencia total → 100%.
- [ ] Test: desacuerdo total → 0%.
- [ ] Test: sin posiciones verificadas → "Sin datos suficientes".
- [ ] Test: cobertura baja → advertencia visible.
- [ ] Test: invariancia por orden de entidades (todas las permutaciones de 5 entidades).
- [ ] Test: reproducibilidad (1000 ejecuciones idénticas).
- [ ] Test: pesos variables no cambian ranking.
- [ ] Test: dimensión vacía no afecta score global.
- [ ] Test: dos dimensiones con cobertura desigual → score global depende de calibración.
- [ ] Test: `explicit_neutral` incluida con valor 0; `not_stated` excluida.
- [ ] Test: entidad sin posiciones evaluables entre entidades con posiciones.
- [ ] Test: posición `not_comparable` excluida solo para esa entidad.
- [ ] Test: calibración rápida produce pesos normalizados correctos.
- [ ] Test: calibración omitida usa pesos por defecto.
- [ ] **Mínimo 50 tests unitarios en total.**

---

### EP-13: Resultados y evidencias

#### SCR-03: Vista de resultados
**Como** visitante, **quiero** ver mis resultados **para** entender mi compatibilidad.

**Criterios de aceptación:**
- [ ] Porcentaje de coincidencia por entidad.
- [ ] Cobertura visible: `n_evaluable`, `n_respondidas`, `coverage_percent`.
- [ ] Advertencia **informativa** si cobertura < 20% (nunca se oculta el resultado).
- [ ] "Sin datos suficientes" si no hay posiciones verificadas.
- [ ] Desglose por dimensión (si implementado).

#### SCR-04: Evidencias clickeables
**Como** visitante, **quiero** ver la evidencia de cada posición **para** verificar la trazabilidad.

**Criterios de aceptación:**
- [ ] Enlace desde resultado a detalle de evidencia.
- [ ] Vista de evidencia: cita, página, fuente, contexto.
- [ ] Diferenciación visual: coincidencias vs. desacuerdos.
- [ ] Condiciones visibles si aplica.

---

### EP-14: Referencias históricas

#### HIS-01: Incorporar entidades históricas
**Como** visitante, **quiero** comparar con referencias históricas **para** explorar coincidencias documentadas.

**Criterios de aceptación:**
- [ ] Entidades con `is_historical` visibles en selección.
- [ ] Etiquetado: país, año, tipo de documento.
- [ ] Selección opcional (no incluida por defecto).
- [ ] Resultados con contexto histórico visible.

#### HIS-02: Comparabilidad histórica
**Como** visitante, **quiero** que las preguntas no comparables se excluyan **para** evitar resultados engañosos.

**Criterios de aceptación:**
- [ ] Estado `not_comparable` excluye pregunta del scoring.
- [ ] Indicador visual: "No comparable con [entidad]".
- [ ] Cobertura refleja exclusiones.

---

### EP-15: Hardening y lanzamiento

#### OPS-01: Despliegue en producción
**Como** administrador, **quiero** desplegar en VPS **para** publicar la plataforma.

**Criterios de aceptación:**
- [ ] Docker Compose en producción.
- [ ] Caddy/Nginx con TLS (Let's Encrypt).
- [ ] Firewall configurado: puertos 22, 443, 80.
- [ ] Variables de entorno seguras.
- [ ] Backups configurados y probados.

#### OPS-02: Pruebas E2E
**Como** desarrollador, **quiero** pruebas E2E **para** verificar flujos completos.

**Criterios de aceptación:**
- [ ] Flujo visitante: catálogo → encuesta → resultados → exportación.
- [ ] Verificación de red: sin respuestas enviadas al servidor.
- [ ] Flujo admin: login → upload → extracción → revisión → publicación.
- [ ] Historial local: guardado, recuperación, borrado.
- [ ] Exportación/importación end-to-end.

#### OPS-03: Textos legales
**Como** administrador, **quiero** textos legales publicados **para** cumplir con RGPD.

**Criterios de aceptación:**
- [ ] Aviso legal publicado.
- [ ] Política de privacidad publicada.
- [ ] Política de cookies publicada.
- [ ] Términos de uso publicados.

---

## 3. Definition of Done global

Una historia está completa cuando:
- [ ] Código implementado y revisado.
- [ ] Pruebas unitarias/passing.
- [ ] Criterios de aceptación verificados.
- [ ] Sin vulnerabilidades de seguridad introducidas.
- [ ] Documentación actualizada si aplica.
- [ ] Funcionalidad verificada en entorno de desarrollo.
