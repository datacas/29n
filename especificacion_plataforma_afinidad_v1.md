# Especificación funcional y técnica — Plataforma de cuestionarios de afinidad

**Versión:** 1.0 (borrador de referencia para implementación)  
**Fecha:** 13 de noviembre de 2026  
**Estado:** Alcance MVP definido; parámetros y cuestiones de validación identificados  
**Idioma de producto inicial:** español; arquitectura preparada para localización  
**Caso piloto:** cuestionario sobre elecciones generales españolas de 2026, con programas aportados por el administrador.  

> **Principio rector:** el producto no indica qué votar ni atribuye identidades ideológicas a las personas. Expone coincidencias y discrepancias entre respuestas voluntarias y posiciones documentadas, identificando límites, cobertura y fuentes. Los programas oficiales son la referencia primaria; ningún modelo de IA puede inventar posiciones.

---

## 1. Resumen ejecutivo

La plataforma ofrece un catálogo público de cuestionarios. Cualquier visitante puede entrar, seleccionar una encuesta, responderla y consultar un informe explicable sin identificarse. El visitante puede guardar el progreso y resultados localmente; **solo si lo desea** puede facilitar un email, verificarlo mediante código temporal de un solo uso (OTP) y guardar sus encuestas en el servidor para recuperarlas más adelante, sin contraseña. El administrador accede mediante OTP y controla íntegramente la ingestión de fuentes, la revisión documental, la creación de preguntas, la configuración de algoritmos, la publicación y el versionado.

La primera encuesta se basa en programas electorales oficiales de las generales españolas de 2026. El catálogo permitirá comparar entidades políticas actuales y referencias históricas opcionales en una misma encuesta, diferenciando el tipo de documento y la comparabilidad temporal. El dominio subyacente será reutilizable para futuros comicios, encuestas históricas y cuestionarios lúdicos (por ejemplo, facciones de videojuegos), pero estos últimos quedan fuera del alcance funcional inicial.

El procesamiento documental puede utilizar LLM, embeddings y clasificadores ligeros (incluido Jev, previa evaluación), siempre como **asistencia editorial**. El motor de resultados es determinista, público en metodología, reproducible y no depende de llamadas a modelos en tiempo de encuesta.

## 2. Objetivos y no objetivos

### 2.1 Objetivos del MVP

1. Publicar y listar encuestas disponibles sin autenticación.
2. Permitir seleccionar las entidades comparadas, incluidas referencias históricas si están habilitadas.
3. Responder cuestionarios con distintas profundidades, saltos, pesos de importancia y revisión de respuestas.
4. Mostrar coincidencia documentada, cobertura documental y explicación de diferencias, sin presentar porcentajes como probabilidades de voto.
5. Vincular toda posición publicada con evidencia primaria verificable y una versión concreta.
6. Proporcionar un panel admin para gestionar entidades, documentos, propuestas, preguntas, mapeos y publicaciones.
7. Procesar documentos con extracción asistida por IA, control de calidad y aprobación humana antes de publicarlos.
8. Mantener el uso público anónimo; habilitar guardado en nube **estrictamente optativo** mediante email + OTP + consentimiento explícito.
9. Conservar releases inmutables, resultados reproducibles por versión y auditoría de cambios editoriales.
10. Desplegar en infraestructura propia con copias de seguridad, observabilidad sin perfiles políticos y controles de seguridad.

### 2.2 Fuera de alcance del MVP

- Estadísticas públicas globales de respuestas y perfiles; se diseñan las restricciones de privacidad, pero no se implementan inicialmente.
- Comparación de promesas con acciones reales de gobierno, votaciones parlamentarias, entrevistas o declaraciones (módulo posterior, fuente y metodología separadas).
- Recomendación de voto, predicción electoral, encuestas de intención de voto o inferencia de ideología personal.
- Red social, comentarios, perfiles públicos, publicidad segmentada y analítica de comportamiento individual.
- Aplicación móvil nativa, integración de pagos y multitenencia editorial.
- Cuestionarios de ficción como contenido publicado del MVP, aunque el modelo los soportará.
- Generación de informes narrativos libres mediante LLM basados en respuestas individuales.

## 3. Actores y permisos

| Actor | Capacidades | Identificación |
|---|---|---|
| Visitante | Ver catálogo; configurar comparaciones; responder; resultado y fuentes; guardar localmente | Ninguna |
| Usuario voluntariamente identificado | Todo lo anterior; guardar/recuperar/eliminar encuestas propias; cerrar sesión; borrar cuenta | Email verificado por OTP; sin contraseña |
| Administrador | Gestionar contenido, modelos, releases, usuarios administrativos, auditoría y configuración | Email permitido + OTP; sesión administrativa independiente |
| Trabajador documental | Extraer, clasificar, proponer enlaces y diagnósticos; nunca publicar | Cuenta de servicio con permisos mínimos |

**Regla:** el estado anónimo jamás debe convertirse automáticamente en perfil servidor. El guardado remoto solo ocurre tras elección expresa, verificación y consentimiento adecuado.

## 4. Experiencia y flujos principales

### 4.1 Visitante anónimo

`Inicio/catálogo → detalle de encuesta → selección de entidades → profundidad → cuestionario → revisión → resultados → fuentes`.

- Entrar no exige email, registro, cookies de marketing ni identificación.
- El usuario puede cambiar opciones de comparación sin que la puntuación de una entidad existente cambie por la mera presencia de otras; sí puede variar si cambia explícitamente el conjunto de preguntas, y el sistema lo declara.
- Se guarda progreso localmente si el usuario lo desea y bajo la política de persistencia definida.
- El usuario puede reiniciar, exportar el resultado en un formato local y borrar sus datos del dispositivo.
- En el informe se distingue claramente `coincidencia`, `cobertura`, `sin posición verificable` y `comparación histórica`.

### 4.2 Guardar remotamente (opcional)

`Resultado → Guardar → explicar tratamiento → email → consentimiento explícito para guardar respuestas políticas → OTP → guardar snapshot → confirmación`.

- No enviar el contenido del informe por correo salvo solicitud separada; OTP no requiere adjuntar resultados.
- Verificación del email **antes** de asociar datos personales y resultados.
- Un email existente accede a su cuenta; uno nuevo la crea tras consentimiento y verificación.
- Si la verificación falla o se abandona, la encuesta sigue disponible localmente y no se crea una cuenta identificada.
- El consentimiento se registra con versión de texto, finalidad, fecha, dirección del usuario y prueba mínima; evitar almacenar IP en ese registro salvo necesidad jurídica documentada.

### 4.3 Recuperar historial

`Mis encuestas → introducir email → código de un solo uso → sesión → historial → abrir snapshot → eliminar encuesta / cuenta`.

- El acceso OTP prueba el control del buzón, no garantiza seguridad absoluta del email; contemplar medidas complementarias ante riesgo.
- Los resultados guardados se anclan a la versión de encuesta y algoritmo utilizada. Una actualización del programa no reescribe resultados antiguos.
- Recalcular con una versión nueva es una acción separada que muestra las diferencias.

### 4.4 Administrador

`/admin → email autorizado → OTP → dashboard → entidades → fuentes → extracción → cola de revisión → banco de preguntas → editor de encuesta → previsualizar → publicar`.

- La edición y la publicación se separan; se registra quién, cuándo, qué y por qué se modificó.
- El admin puede cargar un PDF nuevo, seleccionar entidad/elección/versión, consultar extractos y corregir vínculos de evidencia.
- Una extracción con baja confianza o contradicción queda bloqueada para publicación hasta revisión.
- Posibilidad de despublicar o retirar un release por error grave, manteniendo su auditoría interna.

## 5. Modelo de dominio

### 5.1 Entidades principales

| Entidad | Propósito y campos esenciales |
|---|---|
| `universes` | Ámbito (`politics`, `history`, `games`), nombre, metadatos |
| `consultations` | Convocatoria o contexto (país, tipo de elección, fecha, jurisdicción) |
| `actors` | Partido, coalición, movimiento, facción, civilización, modelo constitucional; tipo, región, vigencia |
| `actor_versions` | Identidad histórica/temporal y nombres por periodo |
| `sources` | Documento primario, tipo (programa/constitución/manifiesto/estatutos), URL original, propietario, fecha, licencia, SHA-256, almacenamiento |
| `source_versions` | Revisiones del documento y metadatos de procedencia |
| `source_segments` | Párrafos/secciones, páginas, offsets, texto exacto y coordenadas opcionales |
| `claims` | Propuesta normalizada; alcance, excepciones, fecha, estatus, revisión |
| `claim_evidence` | Relación claim-segmento con tipo de soporte y citas exactas |
| `topics` | Taxonomía de temas y subtemas versionada |
| `questions` | Redacción neutral, tipo de respuesta, opciones, nivel de profundidad, tema |
| `question_versions` | Redacción, traducción y escala congeladas por release |
| `actor_positions` | Posición con evidencia respecto a pregunta; escala; certeza editorial; contexto |
| `surveys` | Encuesta pública con actores permitidos, versiones y parámetros |
| `survey_releases` | Snapshot inmutable de contenido, posiciones, algoritmo y manifest SHA-256 |
| `scoring_models` | Identificador, versión, código/configuración, criterios y pruebas |
| `saved_surveys` | Snapshot cifrado de respuestas/resultados ligado al usuario y release |
| `accounts` | Email normalizado y protegido, tipo, fechas, consentimiento y borrado |
| `otp_challenges` | Desafíos con hash, vencimiento, intentos, estado y propósito |
| `sessions` | Sesiones opacas, seguras, con rotación/revocación |
| `consent_records` | Consentimientos por finalidad y versión documental |
| `audit_events` | Acciones admin y cambios, con minimización de datos |
| `jobs` | Ingesta y análisis documental con estado, costes, modelo y trazas no sensibles |

### 5.2 Cardinalidades y reglas

- Un actor tiene múltiples documentos y posiciones a través del tiempo.
- Una propuesta solo está `publishable` si está respaldada por un fragmento verificable y validada.
- Una pregunta puede tener posiciones para varios actores y `unknown/not_stated/not_comparable` para otros; ninguno de esos estados equivale a oposición.
- Una encuesta contiene uno o más releases. Un release referencia **versiones concretas** de actores, preguntas, fuentes y scoring.
- Un resultado guardado apunta a un release exacto y guarda los parámetros necesarios para reproducirlo.
- Contenido histórico o institucional se marca por tipo; no se presenta como «candidatura actual».

## 6. Fuentes documentales y calidad de evidencia

### 6.1 Jerarquía de fuentes

1. Documento original emitido por la organización o institución competente, con integridad y procedencia comprobables.
2. Facsímil o copia digital conservada por archivo público/institucional, con metadatos de autenticidad.
3. Reproducción académica o archivística documentada de fuente primaria, marcada como tal y sometida a revisión reforzada.
4. Prensa, agregadores, declaraciones indirectas o inferencias: **no aptas como fuente primaria** para puntuación en el MVP.

Los programas históricos no deben identificarse como programas electorales cuando son constituciones, manifiestos o estatutos. Pueden incorporarse como **referencias históricas** con etiquetas y límites claros.

### 6.2 Campos mínimos de una evidencia

`source_id`, `source_version_id`, `segment_id`, página/artículo, cita literal (breve), URL/copia archivada, actor/version, tipo de documento, fecha, extracción, revisor, estado, observaciones y hash del documento.

### 6.3 Reglas de publicación

- Sin fuente primaria o copia archivística autenticada → no se publica como posición verificable.
- Sin relación textual exacta → no se puntúa.
- Una frase aspiracional sin medida precisa puede etiquetarse como programática pero no necesariamente puntuarse.
- Si una posición está condicionada, la condición debe figurar en pregunta, evidencia o explicación.
- Equivalencias entre épocas requieren revisión y marcadores de comparabilidad.
- Se mantiene el original inalterado y se registra cualquier nueva versión o corrección.

## 7. Pipeline documental asistido por IA

1. **Carga segura:** validar MIME, tamaño, AV, hash, origen y metadatos; almacenar original inmutable.
2. **Extracción:** PDF texto nativo; OCR solo para escaneos; preservar orden, tablas, páginas y offsets.
3. **Segmentación:** párrafos y secciones trazables.
4. **Extracción LLM:** propuestas en JSON validado por esquema; cita obligatoria; condiciones, excepciones y sujetos afectados.
5. **Taxonomía y triaje:** reglas, embeddings y clasificador ligero opcional (Jev u otro) para categorías, duplicados y riesgo.
6. **Vinculación semántica:** candidatos a equivalencia/conflicto con propuestas existentes; LLM justifica sobre citas.
7. **Verificación automática:** cita existe, offsets y páginas correctos, propuesta no más amplia que fuente, campos completos.
8. **Revisión humana:** aceptar, modificar, rechazar o marcar no comparable; registro de decisiones.
9. **Pregunta/posición:** asociar propuestas validadas con preguntas y posiciones; revisarlas con controles de sesgo.
10. **Publicación:** construir release firmado/hash, validarlo con pruebas y publicar.

**Políticas de IA:** modelos y prompts versionados, evaluación periódica con conjunto oro humano; no decisión autónoma de afinidad; no utilizar respuestas personales para entrenar proveedores; redacción humana de publicación; evitar enviar datos identificables de usuarios a modelos.

**Jev:** candidato a clasificador de triaje, no dependencia obligatoria; decisión de adopción tras benchmark sobre corpus real frente a reglas y modelo local. Métricas: precisión/recall por clase, alucinación, coste, latencia y calibración.

## 8. Diseño de cuestionarios

### 8.1 Tipos de preguntas

- Escala ordinal de acuerdo (5 niveles + `no sé` / `prefiero omitir`).
- Opción categórica entre alternativas mutuamente excluyentes, cuando el tema lo requiera.
- Preferencia o prioridad temática, separada de acuerdo.
- Preguntas con contexto explícito (definiciones, alcance, alternativas y fuente).

### 8.2 Profundidad

- Rápida: objetivo 12–15 preguntas.
- Normal: objetivo 30–40 preguntas.
- Profunda: objetivo 80–100 preguntas.

Estos rangos son hipótesis de producto y deben ajustarse tras pruebas de cobertura y usabilidad.

### 8.3 Neutralidad y balance

- Pregunta de una sola idea, lenguaje simétrico y sin etiquetas cargadas.
- No duplicar cuestiones casi equivalentes para inflar artificialmente un tema.
- Definir pesos temáticos base de forma explícita, y permitir al usuario ajustarlos.
- Garantizar cobertura por categorías; una versión nueva del cuestionario crea nuevo release.
- Las preguntas de comparación histórica no deben omitirse selectivamente si ello oculta diferencias esenciales en derechos y libertades.
- Si se compara a actores con documentos de épocas distintas, mostrar qué dimensiones no son comparables.

## 9. Motor de compatibilidad

### 9.1 Principios

- Determinista y sin IA en tiempo de respuesta.
- Independiente de los actores incluidos: el resultado de A no cambia por añadir B si preguntas, respuestas y versión permanecen iguales.
- No convertir posiciones ausentes en coincidencia o desacuerdo.
- Un porcentaje de afinidad es **independiente para cada entidad**; no debe sumar 100 entre partidos.
- El producto no predice voto ni asigna identidad política.
- Transparencia de fórmula, ponderación, coverage, ejemplos y código/test de referencia.

### 9.2 Fórmula inicial candidata (por validar)

Para preguntas comparables y con posición documentada, codificar respuestas y posiciones en [-2,2]. La puntuación por pregunta es:

`score(i,a) = 1 - abs(user_i - actor_ai)/4`

Con peso `w_i` (importancia del usuario × factor temático versionado):

`coincidencia(a) = 100 × sum(w_i × score(i,a)) / sum(w_i)`

El denominador solo comprende ítems comparables con posición documentada. Por separado:

`cobertura(a) = 100 × sum(w_i de ítems comparables y documentados) / sum(w_i de ítems elegibles respondidos)`

Estados especiales: `unknown`, `not_stated`, `not_comparable`, `conflicting_sources`, `not_reviewed`, `skipped`. Estos estados **no** reciben puntuación por defecto.

**Peligro y mitigación:** puntuación 100 % con cobertura 5 % resulta poco informativa; mostrar conjuntamente ambos valores, advertir cobertura insuficiente y, bajo un umbral aún por calibrar, ocultar el porcentaje o marcar «evidencia insuficiente». No ordenar resultados como valoración normativa ni recomendar partidos. En comparaciones históricas incluir dimensiones estructurales de libertades/igualdad y contexto; las coincidencias parciales no implican afinidad con el régimen completo.

### 9.3 Validación metodológica obligatoria

- Revisión independiente de preguntas y posiciones por evaluadores diversos.
- Sensibilidad a selección de preguntas y ponderaciones.
- Invariancia por orden de entidades.
- Reproducibilidad a igual `release_id`, respuestas y configuración.
- Casos extremos: ausencia total, respuestas neutras, saltos, contradicción documental, no comparabilidad histórica.
- Estudios de comprensión de la presentación de porcentajes y cobertura.

## 10. Resultados e informes

El resultado muestra para **cada entidad seleccionada**: coincidencia documentada cuando es calculable, cobertura, desglose temático, cuestiones de acuerdo/desacuerdo, elementos no evaluados y evidencia clickable (documento original, página y fragmento). Indicar siempre fecha/versión y tipo de referencia: candidatura actual, organización histórica, modelo institucional, etc.

Funciones del MVP: revisar respuestas, ajustar pesos, recalcular localmente, consultar metodología, borrar datos locales, guardar opcionalmente. Exportación PDF y envío de informe por email quedan como ampliación salvo que se prioricen explícitamente; en un futuro envío, el email no debe guardarse para otros usos.

## 11. Autenticación passwordless y cuentas

### 11.1 OTP por email

- Código de un solo uso generado con CSPRNG; almacenamiento únicamente del hash autenticado (HMAC/pepper o equivalente seguro).
- Validez objetivo: 10 minutos; un uso; reemplazo/invalidez al solicitar otro, con límites.
- Rate limit por email, IP y dispositivo (sin crear perfiles políticos); enfriamiento, intentos y protección antienumeración.
- Respuestas indistinguibles sobre existencia de cuenta; no filtrar emails administrativos.
- Cookies `Secure`, `HttpOnly`, `SameSite` apropiado; rotación de sesión tras autenticación, CSRF, revocación.
- Administrador: allowlist y permisos; considerar passkey o MFA adicional para acciones críticas.
- Auditoría de acceso administrativo y publicación; retención limitada de seguridad.

### 11.2 Cuentas y guardado

- Email opcional; no nombre, contraseña ni perfil obligatorio.
- Email puede considerarse identificador personal; almacenarlo cifrado o protegido, con índice de búsqueda separado.
- Guardar solo snapshots elegidos por el usuario; controles para eliminar cada encuesta y cuenta completa.
- Consentimiento explícito para guardar respuestas que puedan revelar opiniones políticas, separado de comunicaciones y analítica; retirada y eliminación.
- El propietario del email puede acceder al historial; las sesiones expiran y se pueden cerrar.
- La protección de datos y la base jurídica definitiva requieren revisión especializada antes del despliegue público.

## 12. Privacidad, seguridad y cumplimiento

- **Privacy by default:** servidor no recibe respuestas de visitantes anónimos si el cómputo se ejecuta en navegador.
- Evitar tracking analítico individual, pixel de marketing, grabación de sesiones y publicidad conductual.
- Registros técnicos sin payload de respuestas; sanitización y minimización de IP/retención.
- Cifrado en tránsito y en reposo; secretos fuera de código; separación de roles de BD.
- Controles de acceso a datos guardados (IDOR), políticas de seguridad de contenido, límites de tamaño, análisis de malware de archivos.
- Backups cifrados, restauración probada, retención y eliminación efectiva.
- Aislar worker de documentos no confiables, sin ejecutar macros/scripts; protección SSRF al recuperar URLs.
- Transparencia sobre cookies técnicas, privacidad, responsable, finalidad, plazos, ejercicio de derechos y contacto.
- Evaluación de impacto y análisis jurídico sobre tratamiento de opiniones políticas antes de habilitar almacenamiento remoto.
- No reutilizar respuestas de usuarios con fines de entrenamiento o inferencia política ajena al cuestionario.

## 13. Arquitectura técnica objetivo

| Capa | Selección inicial |
|---|---|
| Frontend + panel | Nuxt 3, Vue, TypeScript (rutas públicas y `/admin` aisladas por roles) |
| Backend API | Node.js 24 LTS + TypeScript; validación de esquemas en frontera |
| BD transaccional | PostgreSQL 17; migraciones SQL nativas y roles separados |
| Recuperación semántica | pgvector + full-text de PostgreSQL |
| Procesamiento | Worker Python para PDF/OCR + LLM, cola de trabajos |
| Documentos | S3 compatible, originales versionados e inmutables |
| Caché / colas | Redis solo si la carga real lo justifica; opción BD jobs inicial |
| Resultados | Paquete TypeScript puro compartido navegador/servidor para verificaciones |
| Infraestructura | Docker, reverse proxy HTTPS, VPS propio, CI/CD con entornos separados |
| Observabilidad | Métricas de jobs/errores/latencias y costes IA; no capturar respuestas políticas |

### 13.1 Monorepo propuesto

```text
affinity-platform/
  apps/
    web/                    # catálogo, encuestas, resultados, cuenta optativa, admin
    api/                    # API, auth, publicación, datos de administración
  workers/
    documents/              # Python: extracción y análisis documental
  packages/
    domain/                 # modelos y validadores compartidos
    scoring/                # algoritmo determinista y tests
    questionnaire/          # reglas de selección de preguntas
    evidence/               # contratos de fuentes y referencias
    ui/                     # componentes reutilizables
  db/
    migrations/             # SQL nativo
    seeds/
  docs/
    product/
    architecture/
    methodology/
    security/
    decisions/
  infra/
    docker/
  tests/
    fixtures/               # fuentes autorizadas y casos de validación
```

### 13.2 API propuesta (esbozo, no contrato definitivo)

- `GET /api/v1/surveys` catálogo público.
- `GET /api/v1/surveys/:slug/releases/current` snapshot público.
- `GET /api/v1/releases/:id/manifest` contenido, preguntas, posiciones, fuentes y scoring versionados.
- `GET /api/v1/sources/:id` metadatos y referencia a documento público autorizado.
- `POST /api/v1/auth/otp/request` solicitar OTP con respuesta anti-enumeración.
- `POST /api/v1/auth/otp/verify` verificar y emitir sesión.
- `GET /api/v1/me/saved-surveys` historial autenticado.
- `POST /api/v1/me/saved-surveys` guardar snapshot tras consentimiento.
- `DELETE /api/v1/me/saved-surveys/:id` borrar resultado.
- `DELETE /api/v1/me` eliminar cuenta y datos sujetos a política legal.
- `POST /api/v1/admin/sources` carga de fuente autorizada.
- `POST /api/v1/admin/sources/:id/process` lanzar pipeline.
- `GET /api/v1/admin/review-queue` revisiones pendientes.
- `POST /api/v1/admin/surveys/:id/releases` preparar/validar release.
- `POST /api/v1/admin/releases/:id/publish` publicación auditable.

Todas las rutas admin requieren autorización del servidor; no basta con ocultarlas en frontend. Cualquier endpoint de informes debe controlar cuidadosamente el envío accidental de respuestas anónimas.

## 14. Administración y estados editoriales

### 14.1 Estados de documento

`uploaded → parsed → analyzed → review_required → approved → published`; salidas `rejected`, `error`, `archived`, `superseded`.

### 14.2 Estados de propuesta y posición

`draft → extracted → validated_by_rules → human_reviewed → approved → released`; también `disputed`, `insufficient_evidence`, `not_comparable`, `withdrawn`.

### 14.3 Estados de encuesta

`draft → preview → quality_check → scheduled/published → archived`; una publicación crea release inmutable.

### 14.4 Panel mínimo

Dashboard de trabajos; gestor de partidos/actores; gestor documental; comparador de versiones de fuentes; cola de revisión con cita y contexto; taxonomía; banco de preguntas; matriz `pregunta × actor`; editor de encuestas; simulador de resultados con datos ficticios; validación; publicación y rollback mediante cambio de release activo.

## 15. Compatibilidad histórica

Los actores históricos aparecen como **referencias opcionales** en las encuestas actuales, claramente separados de candidaturas elegibles. Requisitos:

1. País y fecha visible.
2. Tipo de fuente y fidelidad histórica.
3. Análisis de contexto semántico: no atribuir significado contemporáneo idéntico a términos antiguos.
4. Comparabilidad por dimensión, con estado `not_comparable` cuando corresponda.
5. Preguntas sobre derechos fundamentales, sistema político e igualdad, además de economía, para evitar coincidencias parciales engañosas.
6. No usar etiquetas del tipo «eres X % nazi/comunista»; mostrar coincidencia con **posiciones documentadas de actor y periodo específico**, junto con cobertura y diferencias estructurales.
7. Documentación de hechos históricos y programas sin glorificación, minimización de atrocidades ni equiparación automática entre movimientos distintos.
8. No presentar monarquía vs. república como referéndum español independiente si se usa documentación de 1931/1978; precisar hechos y fuentes.

## 16. Módulos futuros preparados (no incluidos en MVP)

- Encuestas autonómicas, locales y europeas con jurisdicción y candidaturas específicas.
- Ficción/videojuegos; motores de preferencias no presentados como evidencia política.
- Estadísticas agregadas sujetas a umbrales mínimos, controles anti-reidentificación y, de ser viable, privacidad diferencial.
- Informe PDF, envío voluntario por email, exportación de datos.
- Seguimiento del cumplimiento de promesas, basado en fuentes y metodologías separadas.
- Idiomas adicionales, accesibilidad avanzada y panel de autores por permisos.

## 17. Roadmap y entregables

| Hito | Alcance | Criterio de salida |
|---|---|---|
| H0 — Base de proyecto | Monorepo, entornos, DB, migraciones, CI, seguridad inicial, docs | Arranque reproducible y pruebas básicas OK |
| H1 — Fuentes y administración | Actores, fuentes, subida, extracción, revisión, auditoría | Dos PDFs diferentes procesados con citas recuperables |
| H2 — Banco de preguntas | Taxonomía, revisión humana, matriz de posiciones, versionado | Preguntas validadas, sin posiciones inventadas |
| H3 — Motor público | Catálogo, seleccionar entidades, encuesta local, scoring, evidencias | Flujo anónimo completo y reproducible |
| H4 — Cuenta optativa | Email + OTP, consentimiento, guardar, recuperar, borrar | Datos de usuarios aislados; pruebas de seguridad y privacidad |
| H5 — Publicación piloto | Programas disponibles de 2026, QA, monitoreo, política de privacidad | Release público auditable con cobertura transparente |
| H6 — Post-MVP | Históricos enriquecidos, informes, estadísticas, ocio | Planificados por separado tras evidencia de uso |

**Orden de entrega recomendado:** H0 → H1 → H2 → H3 → H4 → H5. Una versión previa anónima puede probarse internamente antes de H4; el MVP definido incluye guardado optativo con email.

## 18. Backlog inicial (épicas y casos de aceptación)

### EP-01 — Catálogo público
- **US-001:** Como visitante, puedo listar encuestas publicadas con título, ámbito, fecha y estado.
- **US-002:** Puedo abrir detalle y consultar qué entidades y fuentes se evalúan.
- **DoD:** Solo se exponen releases publicados; carga sin login; accesibilidad básica teclado/lector.

### EP-02 — Administración documental
- **US-003:** Subo fuente con actor, periodo y procedencia.
- **US-004:** Lanzo extracción y reviso propuestas con evidencia exacta.
- **US-005:** Corrijo/rechazo/apruebo propuestas dejando trazabilidad.
- **DoD:** Ninguna propuesta sin evidencia y aprobación se incluye en release; errores reportados.

### EP-03 — Preguntas y posiciones
- **US-006:** Creo y reviso preguntas neutrales y variantes por profundidad.
- **US-007:** Vinculo posición actor-pregunta con fuentes o la marco desconocida/no comparable.
- **DoD:** La matriz presenta explícitamente ausencias y condiciones.

### EP-04 — Encuesta pública
- **US-008:** Selecciono actores actuales e históricos habilitados.
- **US-009:** Respondo, salto, retrocedo, asigno importancia y reviso respuestas.
- **US-010:** Continúo localmente, reinicio o elimino progreso.
- **DoD:** No llamadas al servidor con respuestas anónimas; test E2E de principio a fin.

### EP-05 — Resultados
- **US-011:** Veo coincidencia y cobertura por actor, explicadas por tema.
- **US-012:** Abro el documento y fragmento que respaldan una posición.
- **US-013:** Ajusto pesos y recalculo sin IA ni perfilado servidor.
- **DoD:** Tests de invariancia, cobertura, ausencia y reproducibilidad.

### EP-06 — Autenticación y guardado optativo
- **US-014:** Solicito OTP con email y verifico mi identidad.
- **US-015:** Consiento explícitamente guardar mis respuestas.
- **US-016:** Recupero y elimino encuestas desde cualquier dispositivo.
- **US-017:** Elimino mi cuenta y retiro consentimiento.
- **DoD:** Protecciones antiabuso, anti-enumeración, sesiones seguras, aislamiento de datos y borrado probado.

### EP-07 — Publicación y gobierno
- **US-018:** Previsualizo release con comprobaciones de calidad.
- **US-019:** Publico nueva versión inmutable y puedo volver a activar la anterior.
- **US-020:** Reviso historial de cambios y costes de procesamiento.
- **DoD:** Los resultados antiguos siguen vinculados al release original.

### EP-08 — Seguridad y operaciones
- **US-021:** Backups y restauración probada.
- **US-022:** Controles frente a subida maliciosa, SSRF, CSRF, XSS, IDOR y abuso OTP.
- **US-023:** Observabilidad sin registro de respuestas políticas individuales.
- **DoD:** Revisión de seguridad y privacidad antes de producción.

## 19. Estrategia de pruebas

**Unitarias:** scoring, taxonomía, estado de evidencia, selección de preguntas, validaciones, OTP expiración/reuso, permisos.  
**Integración:** PostgreSQL, S3, colas, pipeline PDF → propuesta → evidencia → revisión, mail, publicación.  
**E2E:** visitante anónimo, guardado voluntario, recuperación, borrado; admin completa pipeline; cambio de release.  
**Calidad editorial:** conjunto oro de proposiciones y preguntas revisadas manualmente; evaluación inter-revisor y errores graves.  
**Seguridad:** amenazas OWASP, rate limiting, sesión, acceso cruzado, desidentificación de logs, tratamiento y eliminación de datos.  
**Accesibilidad:** WCAG 2.2 AA como objetivo de interfaz pública.

### 19.1 Casos de prueba críticos

1. Seleccionar un nuevo actor sin alterar puntuación de los anteriores cuando el cuestionario y pesos permanecen constantes.
2. Documento que guarda silencio: no puntuar acuerdo ni desacuerdo.
3. Histórico con fuente no comparable: indicar estado y no forzar posición.
4. Copia del PDF modificada: cambia hash y genera fuente/versión nueva.
5. Anónimo: inspección de tráfico confirma que no se transmiten respuestas.
6. OTP reutilizado, expirado o adivinado: rechazo y controles de abuso.
7. Acceso a encuesta guardada de otro usuario: denegado.
8. Retirada de consentimiento: eliminación lógica/inmediata y física conforme política, incluyendo backups bajo ciclo documentado.
9. Release anterior: reproduce los mismos resultados tras actualizar un programa.
10. Pregunta con doble interpretación: bloquear hasta revisión.

## 20. Métricas de calidad del producto (sin perfilado)

- Porcentaje de posiciones con fragmento primario verificable: objetivo 100 % de las publicadas.
- Porcentaje de claims publicados con revisión humana: objetivo 100 % en MVP.
- Tasa de errores críticos de evidencia en muestra auditada: objetivo 0; revisión si aparece alguno.
- Reproducibilidad del scoring a inputs iguales: 100 %.
- Latencia del cálculo en navegador: objetivo perceptiblemente instantáneo para encuestas del MVP (medición con dispositivos de gama baja).
- Cero transmisión de respuestas anónimas en el flujo normal.
- Tasa de errores de importación, coste por PDF y tiempos de cola (operativos, no políticos).

## 21. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Programas incompletos o publicados tarde | Estados de cobertura, fechas, actualización versionada |
| Alucinaciones de IA o citas falsas | Validación exacta, revisión humana, no publicar sin evidencia |
| Preguntas sesgadas o selección asimétrica | Guía editorial, doble revisión, pruebas de sensibilidad |
| Histórico fuera de contexto | Distinción de tipos, comparabilidad y contexto visible |
| Puntuación engañosa con baja cobertura | Mostrar ambos indicadores; umbral de evidencia insuficiente |
| Filtración de opiniones políticas guardadas | Minimización, cifrado, permisos, revisión jurídica, retención limitada |
| Robo de OTP / abuso | Rate limit, caducidad, anti-enumeración, sesiones seguras |
| Dependencia de proveedores LLM | Adaptadores, prompts versionados, corpus oro y fallback |
| Derechos de autor en programas y recursos de juegos | Conservar procedencia; verificar licencias antes de redistribuir PDFs/artwork |
| Cambio de metodología | `scoring_model_version` y releases inmutables |

## 22. Decisiones cerradas

- Web pública y administración privada.
- Acceso público anónimo, sin email obligatorio.
- Guardado remoto **optativo** mediante email verificado por OTP; sin contraseñas.
- Admin por email OTP con autorización específica.
- Programas y fuentes primarias; actualización progresiva de documentos.
- LLM/embeddings/clasificadores solo para preparación y revisión documental.
- Scoring determinista, reproducible, independiente por actor.
- Mostrar cobertura y evidencia; no equiparar ausencia a oposición.
- Comparaciones históricas opcionales integradas en encuestas actuales, con contexto.
- Núcleo reutilizable para otros tipos de cuestionarios.
- Estadísticas globales y secciones adicionales fuera del MVP.

## 23. Decisiones abiertas y validaciones pendientes

1. **Nombre y dominio comercial del producto.**
2. **Frontera del MVP:** ¿el PDF exportable/email de informe sale en la primera versión o después? La especificación lo deja posterior.
3. **Escala exacta y normalización:** 5 puntos, preguntas categóricas, ponderación y calibración.
4. **Umbral de cobertura:** cuándo ocultar porcentajes por evidencia insuficiente.
5. **Política editorial:** revisión simple por el administrador o doble revisión independiente para casos sensibles.
6. **Motor de selección de preguntas:** banco fijo por modalidad en primera versión vs. adaptación dinámica; recomendado fijo y versionado inicialmente.
7. **Elección del proveedor LLM y benchmark de Jev:** pendiente de pruebas con documentos aportados.
8. **Política y plazo de retención para cuentas, logs, OTP y backups.**
9. **Proveedor de email transaccional**, deliverability y protección antiabuso.
10. **Evaluación jurídica y de protección de datos**, especialmente por guardado de opiniones políticas identificables.
11. **Disponibilidad y autenticidad de programas concretos de 2026 e históricos**, antes de publicarlos; no asumir como verificados enlaces tratados en conversaciones previas.
12. **Licencia de contenidos de programas**, documentos y futuras franquicias de videojuegos.
13. **Política lingüística inicial** (castellano y posterior valenciano/otros idiomas).

## 24. Definition of Done de lanzamiento público

El MVP está listo cuando: (a) existe al menos una encuesta publicada con preguntas y posiciones revisadas, (b) todas las posiciones puntuadas enlazan evidencia verificable, (c) un visitante la completa sin login ni fuga de respuestas a servidor, (d) el resultado explica coincidencia/cobertura y es reproducible por versión, (e) el usuario puede guardar/recuperar/borrar voluntariamente mediante OTP y consentimiento, (f) el administrador importa, revisa y publica un nuevo programa, (g) las pruebas de seguridad, privacidad y restauración pasan, y (h) están disponibles metodología, avisos legales y canales de corrección de errores.

---

## Apéndice A — Ejemplo de manifest de release (ilustrativo)

```json
{
  "survey_id": "es-generales-2026",
  "release": "1.0.0",
  "release_hash": "sha256:...",
  "consultation": "es-general-2026",
  "scoring_model": { "id": "agreement-weighted", "version": "0.1.0" },
  "actor_versions": ["actor-a@2026-11", "actor-b@2026-11"],
  "question_versions": ["q-001@1", "q-002@1"],
  "source_versions": ["s-001@1", "s-002@1"],
  "historical_comparisons_enabled": true,
  "published_at": null
}
```

## Apéndice B — Términos de interfaz recomendados

Preferir «Coincidencia documentada», «Cobertura», «Sin posición verificable», «Comparación histórica» y «Ver fuente»; evitar «El partido que debes votar», «Probabilidad de voto» y «Eres X % [ideología]».

**Fin de la especificación v1.0.**
