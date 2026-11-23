# Especificación funcional y técnica — Plataforma de cuestionarios de afinidad

**Versión:** 1.1 — consolidación de decisiones 1–13  
**Fecha:** 13 de noviembre de 2026  
**Estado:** alcance del MVP aprobado; pendientes de validación identificados explícitamente  
**Nombre comercial/dominio:** pendiente; identificador técnico provisional `affinity-platform`  
**Idioma de lanzamiento:** castellano; arquitectura internacionalizada  
**Caso piloto:** elecciones generales españolas de 2026, con referencias históricas seleccionables.

> **Principio rector.** La web muestra coincidencias y desacuerdos entre respuestas voluntarias y posiciones documentadas; no aconseja a quién votar, no infiere identidades ideológicas ni equipara coincidencias parciales con adhesión a un régimen histórico. Cada afirmación debe ser trazable a evidencia primaria y cada resultado debe poder reproducirse.

## 1. Resumen ejecutivo

Web pública y gratuita donde cualquiera puede explorar encuestas, responder sin identificación y ver resultados explicables. Las respuestas, preferencias, progreso y resultados se calculan y conservan **exclusivamente en el navegador** (IndexedDB y memoria de ejecución); se pueden exportar e importar mediante archivo local. El servidor **no recibe ni guarda respuestas o puntuaciones individuales**. No existe cuenta pública, login, email, envío de informes ni recuperación en la nube.

Un único administrador gestiona entidades, programas originales, propuestas extraídas con asistencia de IA, referencias documentales, preguntas, posiciones, versiones y publicación. Se despliega inicialmente en un VPS propio, con PostgreSQL y documentos locales. No se usa AWS, S3 ni almacenamiento de objetos. La infraestructura se mantendrá simple y de coste mínimo.

El MVP comprende encuestas políticas actuales, incorporación voluntaria de referencias históricas, banco de preguntas revisadas, cálculo ponderado/multidimensional, cobertura visible y panel de administración. Los cuestionarios de videojuegos y las estadísticas globales de respuestas quedan fuera del MVP, aunque la arquitectura admitirá ambos.

## 2. Registro de decisiones 1–13

| Nº | Decisión | Estado y resolución |
|---|---|---|
| 1 | Nombre y dominio | **Pendiente**, no bloqueante. Usar identificador técnico provisional. |
| 2 | Alcance | **Confirmada:** MVP completo: encuestas políticas, históricos opcionales, resultados explicables, administración. El guardado remoto inicialmente incluido fue **revocado** en decisión 10. |
| 3 | Afinidad | **Confirmada:** modelo C, ponderado por relevancia asignada y multidimensional; fórmula y calibración por validar. |
| 4 | Cobertura | **Confirmada:** cada partido puntúa solo sobre preguntas con posiciones verificadas; las ausencias se excluyen; mostrar cobertura y n.º de preguntas; sin umbral mínimo fijo; si ninguna es evaluable, «Sin datos suficientes». |
| 5 | Validación IA | **Confirmada:** extracción/verificación asistidas por IA; propuestas sin incidencias para aprobación humana por lotes; incidencias individuales; publicación siempre autorizada por admin. |
| 6 | Preguntas | **Confirmada:** banco revisado con selección adaptativa determinista; en MVP, conjuntos estables por modalidad/versión. Adaptación tras validación. |
| 7 | Modelos IA | **Confirmada:** híbridos configurables por tarea/proveedor, locales o APIs externas; JEV u otros como candidatos tras benchmark; scoring público sin LLM. |
| 8 | Conservación | **Confirmada/revisada:** estadísticas realmente anónimas se podrán conservar indefinidamente en fase futura; historial personal solo en navegador y borrable allí; pocos documentos en disco; copias básicas sin política compleja impuesta. |
| 9 | Email | **Superada parcialmente:** se eligió Brevo gratuito, pero se ha **eliminado todo email para visitantes**. No desplegar Brevo para usuarios; queda pendiente determinar si el admin necesita email/OTP o utiliza passkey. |
| 10 | Privacidad | **Confirmada/revisada:** sin cuentas públicas, correo, OTP de usuarios, envío de respuestas ni informes; cálculo y almacenamiento personales solo locales; exportación/importación manual. |
| 11 | Fuentes | **Confirmada:** fuentes primarias y archivos institucionales verificables, con atribución y trazabilidad de página/fragmento. |
| 12 | Derechos | **Confirmada:** originales internamente; público ve propuestas resumidas, citas breves y enlaces a las fuentes; no redistribuir PDFs/imágenes/logos de terceros sin derechos suficientes. |
| 13 | Idiomas | **Confirmada:** i18n en arquitectura; lanzamiento castellano; idiomas posteriores activables desde administración con traducciones verificadas; originales inmutables. |

**Precedencia:** las decisiones más recientes revocan cualquier funcionalidad incompatible de la especificación 1.0. En particular: no hay cuentas, emails, OTP ni informes enviados para visitantes; Brevo queda fuera del MVP mientras no se confirme un uso administrativo.

## 3. Objetivos y límites del MVP

### Incluido

1. Catálogo público de encuestas publicadas, filtrado por categoría y detalle de cada una.
2. Encuesta de generales 2026: seleccionar partidos actuales y referencias históricas habilitadas; escoger profundidad; responder y ponderar; revisar respuestas; obtener informes.
3. Historial y progreso local en IndexedDB con opción de borrado, exportación e importación de archivos.
4. Resultados por entidad y dimensión, coincidencias/desacuerdos, cobertura y enlaces a las evidencias.
5. Panel admin autenticado para cargar fuentes oficiales, revisar propuestas/posiciones, administrar preguntas, previsualizar y publicar releases.
6. Pipeline documental local con extracción mediante Python, clasificación, verificación independiente y cola de revisión supervisada.
7. Versionado inmutable de versiones publicadas, algoritmo y referencias.
8. Despliegue simple en VPS, PostgreSQL local, directorio local de documentos, TLS, backups básicos y auditoría de administración.
9. Infraestructura de internacionalización con contenido inicial castellano.

### Excluido expresamente

- Registro/login público, email de usuario, cuentas, OTP público, historial de respuestas en servidor, enviar PDF por correo, links de recuperación.
- AWS/S3/MinIO, Kubernetes, cola distribuida u otros servicios operativamente injustificados.
- Estadísticas globales basadas en respuestas y telemetría individual de comportamiento (fase posterior, nuevo análisis de privacidad).
- Integración de promesas con cumplimiento de gobiernos, entrevistas, redes sociales o votaciones parlamentarias en el cálculo del MVP.
- Tests lúdicos públicos de videojuegos en el primer lanzamiento (solo extensibilidad de dominio).
- Etiquetar a usuarios como «nazi», «comunista», etc. o recomendar voto.

## 4. Actores y autorización

| Actor | Capacidades | Identidad |
|---|---|---|
| Visitante | Catálogo, configuración, respuesta, resultado, exportar/importar/borrar historial local | Ninguna |
| Administrador | CRUD de contenido, importación, revisión, verificación, configuración, publicación, auditoría | Acceso administrativo seguro, mecanismo **pendiente** |
| Worker documental | Procesar trabajos internos sin publicar | Credenciales de servicio locales |

No existe entidad `public_users` ni endpoints de sesiones públicas.

### Decisión pendiente crítica: acceso del administrador

Se acordó inicialmente email+OTP para administración, pero después se decidió prescindir de emails para los visitantes y de los servicios de envío. **No se ha confirmado explícitamente un nuevo mecanismo administrativo.** Alternativas: passkeys/WebAuthn sin email (preferencia técnica por simplicidad sin proveedor), o mantener OTP administrativo con proveedor gratuito/SMTP. Antes del desarrollo de autenticación se elegirá una y se definirá recuperación ante pérdida de credencial (por ejemplo, una segunda passkey y códigos de emergencia guardados offline).

## 5. Flujos de usuario público

1. `Catálogo → ficha de encuesta → elegir entidades (históricos opcionales) → modalidad → preguntas → revisión → resultados → detalles/evidencias`.
2. Cada respuesta y peso se calcula en el navegador; **no se hace POST a la API con respuestas ni resultados**.
3. Se conserva progreso mediante IndexedDB si el navegador lo permite. Mostrar aviso claro: los datos locales pueden perderse al limpiar almacenamiento, cambiar dispositivo o navegar en modo privado.
4. En «Mis encuestas» se listan **solo resultados locales**, con fecha, versión y acceso a revisión; se puede borrar uno o todos.
5. Exportación descargable en JSON versionado y, si es barato implementarlo, presentación imprimible/PDF vía navegador. Importación del JSON con validación de esquema y rechazo de ficheros excesivos o malformados.
6. Nunca cargar fuentes/documentos remotos que permitan a terceros observar respuestas o resultados; los enlaces externos se abren solo por acción expresa del usuario.

### Funcionamiento offline parcial

Tras cargar una encuesta publicada, el cálculo y la navegación deben poder realizarse sin solicitudes que contengan las respuestas. No es requisito MVP una PWA plenamente offline; no prometer acceso al catálogo sin red.

## 6. Administración y publicación

`/admin → autenticación → dashboard → entidades → documentos → extracción IA → verificación → incidencias/aprobación por lotes → preguntas y posiciones → previsualización → publicar`.

- Upload de PDF y ficheros permitidos con límites configurables y comprobación de tipo real; almacenamiento fuera del directorio público.
- Registrar origen, URL, fecha de obtención, hash SHA-256, licencia conocida, idioma, edición y período histórico.
- Conservar original local inmutable; las versiones nuevas son documentos diferentes.
- Extraction de propuestas con texto literal, localizador (página/artículo), descripción normalizada, condiciones, tema y límites interpretativos.
- Verificación contra documento original mediante etapa independiente y validaciones deterministas: existencia de la cita, localizador, duplicados, contradicciones aparentes y coherencia.
- Clasificaciones de IA son sugerencias; ninguna posición dudosa se publica sin revisión.
- Aprobación por lotes para propuestas que superan validaciones y revisión individual de incidencias; **el admin autoriza siempre el release**.
- Previsualización de cuestionario y matriz de cobertura por entidad/dimensión antes de publicar.
- Auditoría editorial: autor administrativo, instante, operación, revisión anterior y motivo cuando aplique.

### Estados

- Documento: `uploaded → parsed → reviewed → accepted | rejected`.
- Propuesta/posición: `draft → machine_checked → needs_review | ready_for_batch → approved | rejected`.
- Encuesta: `draft → validated → published → archived`; una release publicada es inmutable (solo retiro/despublicación por motivo justificado).

## 7. Modelo de dominio y datos (orientativo)

| Entidad/tabla | Función |
|---|---|
| `universes` | política, historia, ficción; taxonomía extensible |
| `consultations` | encuesta concreta, ámbito, elección, fechas, idioma base |
| `entities` | partidos, coaliciones, organizaciones históricas, modelos institucionales, facciones |
| `entity_versions` | versión temporal de una entidad y su marco histórico |
| `sources` | documentos originales, metadatos, archivo local, hash, licencia, procedencia |
| `source_passages` | pasajes con localizadores verificables |
| `claims` | propuestas normalizadas con literal, condiciones y estado editorial |
| `topics` y `dimensions` | temas y dimensiones de la comparación |
| `questions`, `question_translations` | pregunta canónica, opciones, traducción revisada |
| `positions` | entidad + pregunta + postura + evidencia + condiciones + estado |
| `scoring_models` | fórmula, reglas, versión y configuración de ponderación |
| `survey_releases` | snapshot publicado de preguntas, posiciones, entidades y metodología |
| `document_jobs` | ejecución de importación, modelos, coste y errores |
| `editorial_audit` | trazabilidad del administrador |
| `admin_credentials`, `admin_sessions` | solo administración, sujeto a mecanismo de login pendiente |

**No crear:** `users`, `saved_surveys`, `individual_answers`, `personal_results`, `email_otps` para visitantes, o estadísticas por sesión que puedan reconstruir perfiles.

Las respuestas locales usarán un esquema independiente (`local_survey_session`) con `survey_release_id`, respuestas, pesos, selección de entidades, fecha local, versión de fórmula y snapshot opcional de resultados. Identificadores locales aleatorios, nunca reenviados al backend.

## 8. Fuentes: criterios de admisión

Fuentes admitidas para posiciones programáticas:

1. Documentos publicados por el partido/entidad en su web oficial.
2. Documentos originales preservados por archivos institucionales, BOE, Congreso, bibliotecas o repositorios públicos con autenticación documental.
3. Reproducciones facsimilares verificadas que permitan comprobar procedencia y fidelidad.

Trabajos académicos y prensa podrán ayudar a localizar/contextualizar, pero no sustituirán por defecto la evidencia primaria de una posición programática del MVP.

Campos mínimos: `source_id`, entidad, título, año, tipo (`programa`, `manifiesto`, `constitución`, etc.), editorial/emisor, URL original, hash, idioma, página/artículo/fragmento, edición y estado de revisión.

**Ausencia de propuesta no significa neutralidad ni oposición.** Posiciones inferidas solo a partir del nombre o ideología del partido están prohibidas. No equiparar normas constitucionales, programa partidista y actuación histórica como un mismo tipo de fuente.

## 9. Pipeline IA híbrido y económico

1. Ingesta PDF/HTML y extracción local de texto; OCR solo si el documento lo requiere.
2. División por secciones conservando referencias a páginas.
3. LLM extractor configurable con salida validada por esquema y evidencia textual obligatoria.
4. Verificador separado sobre fuente literal; controles automáticos y cola de incidencias.
5. Embeddings multilingües y pgvector opcionales para sugerir temas, equivalencias y contradicciones; nunca como única evidencia.
6. Clasificadores ligeros/locales (incluidos candidatos como JEV) solo tras comparar con un conjunto de evaluación revisado manualmente.
7. Publicación por autorización del administrador; capturar versión de modelo/prompts/criterios y costes cuando corresponda.

Para MVP: usar procesamiento local gratuito cuando alcance calidad suficiente; proveedores externos solo configurables cuando estén disponibles/justificados. **No garantizar que todos los LLM de máxima calidad son gratuitos**. El módulo público de afinidad nunca llama al LLM.

## 10. Banco de preguntas y diseño de encuestas

- Redacción clara, neutral y centrada en medidas verificables; evitar preguntas dobles, presupuestos engañosos y formulaciones valorativas.
- Respuesta ejemplo: escala de acuerdo de cinco niveles más «no sé / omitir»; importar el sentido de la afirmación de forma consistente.
- Importancia opcional o configurable (p. ej. baja/media/alta), con posibilidad de modificarla al revisar el resultado.
- Temas equilibrados: economía, trabajo, vivienda, sanidad, educación, derechos, instituciones, territorio, medio ambiente, etc.
- Modalidades rápida/normal/profunda con tamaño **configurable**; números ilustrativos 15/40/100, sin compromiso hasta pruebas de cobertura.
- MVP: sets de preguntas estables y versionados por modalidad. Adaptación determinista posterior, tras benchmark; no preguntas generadas al vuelo para cada visitante.
- La selección de entidades no debe alterar arbitrariamente la puntuación de una entidad ya evaluada. Si la selección modifica la batería de preguntas de modo explícito, explicar el cambio y no tratar porcentajes de baterías distintas como directamente comparables.
- No publicar preguntas sin revisión editorial y asignación de posiciones documentadas cuando existan.

## 11. Motor de compatibilidad y cobertura

### Reglas confirmadas

- Modelo ponderado y **multidimensional**; cálculo determinista TypeScript portable al navegador.
- Cada partido solo tiene denominador sobre posiciones **documentadas y evaluables** para preguntas que el usuario respondió.
- Sin posición verificable ⇒ esa pregunta se excluye del numerador **y del denominador** de ese partido.
- «No sé»/omisión ⇒ no suma ni penaliza a ninguna entidad.
- Porcentajes independientes por entidad; **no deben sumar 100 %**.
- Mostrar siempre `n_evaluable`, `n_respondidas`, cobertura en preguntas y, para ponderaciones, cobertura de peso (y dimensiones cubiertas).
- Sin ninguna posición evaluable ⇒ «Sin datos suficientes», no `0 %`.
- No hay umbral mínimo fijo de cobertura; advertencia visible cuando la cobertura es reducida.

### Fórmula candidata (no calibrada aún)

Para pregunta evaluable `i` y entidad `p`, normalizar respuesta `u_i` y posición verificada `v_{ip}` en `[-2,2]`; proximidad `s_{ip}=1-|u_i-v_{ip}|/4`; peso del usuario `w_i≥0`.

`C_p = 100 × (Σ_{i∈E_p} w_i s_{ip}) / (Σ_{i∈E_p} w_i)`.

`E_p` son solo preguntas respondidas con posición documentada y equivalencia aceptada; si el denominador es 0, estado «Sin datos suficientes». Para el modelo multidimensional, calcular primero por dimensión y definir cómo combinar dimensiones con cobertura desigual, sin duplicar peso ni permitir que una dimensión sobre-representada domine inadvertidamente. **La regla exacta de agregación, normalización, pesos por dimensión y manejo de posiciones condicionadas sigue pendiente de pruebas metodológicas**.

No presentar porcentaje como probabilidad, certeza estadística, predicción o recomendación de voto.

### Pruebas obligatorias de metodología

- Neutralidad y equilibrio de preguntas; comprobar que una entidad no obtiene más puntos por redacción o ausencias.
- Casos extremos: todo desconocido, una sola propuesta conocida, pesos cero, resultados empatados, preguntas invertidas, diferentes dimensiones, cambios de release.
- Sensibilidad a elección de preguntas y prioridades; comparación de cobertura entre programas extensos y breves.
- Documentar límites de comparabilidad histórica y de cobertura.

## 12. Comparaciones históricas dentro de la encuesta

Se podrán activar opcionalmente entidades históricas junto a partidos actuales. Mostrar etiqueta inequívoca con país, año y tipo de documento (p. ej. NSDAP, programa de 1920; bolcheviques, programa adoptado de 1919; España 1931, Constitución).

- Comparar solo preguntas trasladables con sentido histórico; sin equivalencia ⇒ no evaluable.
- Separar coincidencia sobre propuestas, marco institucional, derechos y práctica histórica; no deducir identidad ni afinidad doctrinal total a partir de puntos económicos compartidos.
- Las decisiones «monarquía o república» son cuestiones institucionales, no siempre posiciones atribuibles a todo partido.
- Diferenciar programas de partidos, constituciones, manifiestos y documentos institucionales; documentar contexto y traducciones.
- Evitar resultados como «eres X % nazi/comunista»: presentar «coincidencia con posiciones documentadas de [entidad, año]» y cobertura.

## 13. Privacidad por arquitectura

- No exigir datos personales para acceder o responder; no identificar visitantes.
- Respuestas, pesos, selección de opciones y resultados **no salen del navegador** y no se registran en el backend, logs ni analítica.
- La API entrega contenidos públicos **ya aprobados** (preguntas, posiciones, evidencia, metadatos); el cliente hace el scoring.
- IndexedDB para historial local y exportación manual; borrar en navegador bajo control del visitante.
- Sin cuentas públicas, envío de emails, OTP públicos, persistencia remota ni proveedor transaccional de correo para visitantes.
- Evitar telemetría de terceros, píxeles, rastreadores; minimizar logs HTTP (IP y user-agent pueden seguir siendo datos personales a efectos legales) y no incluir respuestas en URLs ni peticiones.
- Cifrado HTTPS, control admin, inputs validados, actualizaciones de dependencias y backups simples siguen siendo necesarios aunque no se guarden respuestas de usuarios.
- RGPD/cookies: una arquitectura sin perfiles reduce riesgo, pero no exime de información legal sobre hosting, logs, posibles cookies administrativas y tratamiento de datos del admin.

### Estadísticas globales — futuro, no implementado

La intención es conservar **indefinidamente** agregados realmente anónimos. Si nunca se transmite información desde el navegador, solo se podrán obtener métricas de servicio con límites (y logs minimizados); no distribuciones globales de respuestas. Cualquier estadística de respuestas requerirá una decisión posterior, una técnica de agregación que no permita reconstruir respuestas individuales, evaluación de protección de datos y, si procede, participación voluntaria. **No incluir una puerta trasera de envío de respuestas en MVP**.

## 14. Arquitectura técnica de coste mínimo

| Capa | Elección inicial |
|---|---|
| Web + admin | Nuxt 3, Vue, TypeScript; UI responsive |
| Backend | Node.js 24, TypeScript; API privada para admin y pública de contenido |
| BBDD | PostgreSQL 17 local; pgvector si aporta valor |
| Documentos | Carpeta del VPS fuera de raíz pública, con control de acceso |
| Worker IA | Python local ejecutado bajo trabajos controlados; sin sistema distribuido inicial |
| IA | Adaptadores a local/servicio externo configurables |
| Scoring | Paquete TS puro ejecutado **en cliente** |
| Operación | Docker Compose, Nginx/Caddy, HTTPS, backups básicos |
| Envío de email | **Ninguno para público**; admin pendiente |
| S3/AWS/MinIO | **No** |

### Monorepo orientativo

```text
affinity-platform/
  apps/
    web/                    # catálogo, encuesta, resultados, historial local
    admin/                  # puede convivir en la app Nuxt si simplifica
  packages/
    domain/                 # modelos y validación
    scoring/                # cálculo puro, determinista
    question-bank/          # selección y contratos
    evidence/               # referencias, revisión documental
    i18n/                   # traducciones y localización
  services/
    document-worker/        # extracción Python
  db/
    migrations/             # SQL versionado
  docs/
    decisions/
    methodology/
    architecture/
    privacy/
  tests/
  docker-compose.yml
```

No imponer monorepo multinodo si para MVP conviene una única Nuxt app con rutas `/admin` y un worker local.

### API orientativa

| Método | Ruta | Datos |
|---|---|---|
| GET | `/api/surveys` | catálogo publicado |
| GET | `/api/surveys/:id/releases/:release` | preguntas y opciones oficiales |
| GET | `/api/surveys/:id/positions` | posiciones aprobadas y evidencia; preferir snapshot de release |
| GET | `/api/sources/:id/metadata` | metadatos públicos, cita y enlace al original (no PDF interno) |
| POST | `/api/admin/sources` | upload documento, autenticado |
| POST | `/api/admin/sources/:id/process` | iniciar job local, autenticado |
| GET | `/api/admin/review-queue` | propuestas pendientes |
| POST | `/api/admin/approvals` | aprobar por lote/individual |
| POST | `/api/admin/surveys/:id/publish` | publicar snapshot inmutable |

**Prohibido en MVP:** endpoints de POST de respuestas/resultados, guardado de encuestas personales, registro público o email a visitantes.

## 15. Internacionalización (decisión 13)

- Idioma disponible al lanzar: castellano (`es-ES`).
- Todos los textos de interfaz extraídos a claves de i18n; entidad/pregunta/propuesta tienen idioma canónico y traducciones versionadas.
- Incorporación progresiva desde administración de valenciano/catalán, gallego, euskera, inglés u otros, activados solo cuando se hayan revisado.
- Los documentos originales y sus hashes son inmutables; las traducciones nunca sustituyen evidencia textual original.
- La lengua elegida no debe afectar a la fórmula o resultado para las mismas respuestas semánticas.
- Si falta una traducción, política de fallback al castellano con indicación clara; no publicar una versión parcialmente traducida sin revisión.

## 16. Derechos de autor y reutilización

- Conservar documentos internamente para análisis y auditoría; revisión de derechos para cada fuente.
- Publicar propuesta propia normalizada, **cita breve** dentro de límites aplicables y enlace al original; no servir PDFs originales de terceros desde la web sin permiso/licencia.
- Las fuentes institucionales pueden tener condiciones de reutilización; comprobarlas caso por caso.
- Para universos lúdicos futuros: cuestionarios propios, sin reproducir logos, arte, textos extensos o materiales protegidos sin autorización; mostrar independencia de las marcas.

## 17. Seguridad y operaciones proporcionadas

Mínimos: TLS, acceso administrativo robusto, código/paquetes actualizados, verificación de tipos y tamaños en uploads, protección contra ejecución de archivos cargados, SQL parametrizado, validación de entradas, sesión segura, rate limits en administración, secretos fuera del repositorio, y logs sin respuestas personales.

- Almacenamiento: PostgreSQL + documentos del VPS; backups simples configurados según recursos disponibles. Sin exigir réplicas, almacenamiento remoto sofisticado, RPO/RTO empresarial ni políticas rígidas de «30 días».
- Aceptar pérdida eventual de historiales **locales** y limitaciones de recuperación; documentar al usuario que exporte lo importante.
- Auditoría admin y posibilidad de revertir una publicación incorrecta.
- Al no haber cuentas públicas, no implementar cifrado de historiales en servidor ni borrado de cuentas inexistentes.

## 18. Estrategia de pruebas y criterios de aceptación

### Funcionales

- Usuario puede responder y obtener informe sin pedir correo, nombre, registro ni OTP.
- Ninguna petición HTTP contiene respuestas, pesos, selección privada o resultados; revisar con test de red E2E.
- Recarga conserva historial local (si el navegador no lo ha purgado); exportar/importar reproduce respuestas y referencias a release, con validación de integridad estructural.
- Borrado local elimina sesiones elegidas.
- Partidos sin evidencia se excluyen del denominador; ninguno evaluable ⇒ «Sin datos suficientes».
- Cambio de orden de entidades no altera score; score repetido en mismos inputs es idéntico.
- Visualización de cobertura efectiva, dimensiones, fuentes y estado histórico es obligatoria.

### IA/editorial

- Cada propuesta apunta a fuente y localizador válidos; el auditor puede volver al fragmento original.
- La publicación falla si hay propuestas no aprobadas utilizadas en encuesta.
- Aprobación por lote registra los IDs exactos y deja rastro; incidencias requieren revisión individual.
- Cada release genera fingerprint/hash de sus datos y algoritmo; no se modifica in situ.
- La ausencia se representa como desconocido, no como posición neutra.

### Seguridad/operación

- Subidas malformadas no ejecutan contenido ni quedan públicamente accesibles.
- Sin rutas públicas de autenticación ni SMTP para visitantes.
- Acceso admin no se publica hasta cerrar mecanismo y recuperación.
- Restore básico comprobado al menos una vez antes de publicación.

## 19. Roadmap por hitos

| Hito | Alcance | Dependencia |
|---|---|---|
| H0 — Fundamentos | Repositorio, Docker Compose, DB, CI, convención de evidencias, i18n, decisión de auth admin | Acceso admin pendiente |
| H1 — Documentos | Upload local, parser PDF/HTML, fuentes, hashes y revisión IA | H0 |
| H2 — Banco | Propuestas verificadas, temas, posiciones, preguntas, versiones | H1 |
| H3 — Público | Catálogo, encuesta local, histórico IndexedDB, exportación/importación | H2 |
| H4 — Scoring | Motor multidimensional probado, cobertura, resultados y evidencias | H2–H3 |
| H5 — Históricos | Referencias seleccionables con comparabilidad y contexto | H4 |
| H6 — Lanzamiento | Hardening, pruebas E2E, revisión editorial/legal proporcional, despliegue | H0–H5 |

**No comprometer desarrollo futuro:** estadísticas agregadas, juegos, más idiomas, nuevas elecciones, explicaciones comparativas más sofisticadas.

## 20. Backlog inicial con aceptación

| ID | Historia | Criterio principal |
|---|---|---|
| SYS-01 | Crear monorepo y Docker local | `docker compose up` levanta web, API y DB |
| SYS-02 | Migraciones SQL/versiones | DB reproducible y datos de fixtures |
| ADM-01 | Acceso seguro admin | Solo identidad autorizada; recuperación probada |
| DOC-01 | Subir fuente original local | Archivo no público, SHA-256 y metadatos |
| DOC-02 | Parsear PDF con referencias | Texto por página verificable |
| DOC-03 | Extraer y verificar propuestas | Errores visibles; sin auto-publicación |
| DOC-04 | Aprobación por lote/individual | Auditoría de aprobación |
| QST-01 | Banco de preguntas revisadas | Validación de neutralidad, opciones y traducción |
| QST-02 | Matriz entidad-pregunta-evidencia | Detectar ausencias y cobertura |
| QST-03 | Publicar release inmutable | Snapshot reproducible y hash |
| PUB-01 | Catálogo y filtros | Ver solo encuestas publicadas |
| PUB-02 | Encuesta local y prioridades | Ninguna respuesta enviada al servidor |
| PUB-03 | Guardar/borrar historial local | IndexedDB y UI de gestión |
| PUB-04 | Exportar/importar JSON | Validación y reproducción |
| SCR-01 | Motor de scoring TS | Pruebas deterministas y casos límite |
| SCR-02 | Resultados explicables | Coincidencia, cobertura y evidencias |
| HIS-01 | Incorporar históricos | Solo preguntas comparables, advertencias claras |
| I18N-01 | Arquitectura de idiomas | `es-ES` completo y fallback probado |
| OPS-01 | Despliegue simple y backup | Restauración mínima probada |
| QA-01 | E2E privacidad/no red | No fuga de respuestas ni historiales |

## 21. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Programas incompletos | Cobertura visible y ausencias excluidas, sin imputación |
| Desigualdad de longitud entre programas | Equilibrio de temas y análisis de sensibilidad |
| Interpretaciones falsas por IA | Citas verificables, validador independiente y aprobación admin |
| Coincidencias con extremismos mal interpretadas | Contexto histórico, dimensiones separadas, sin etiquetar usuarios |
| Historial perdido por limpieza de navegador | Aviso y exportación/importación local |
| Privacidad erosionada por estadísticas futuras | No instrumentar recolección hasta diseño específico |
| Cambios de programas tras publicar | Releases inmutables/versionadas |
| Dependencia de proveedores y costes | Adaptadores y preferencia por modelos locales |
| Acceso admin perdido o comprometido | Definir dos credenciales/recovery antes de lanzar |
| Derechos de documentos | Original interno, cita limitada y enlace externo |

## 22. Pendientes reales antes de implementar

### Bloqueantes para componentes concretos

1. **Acceso admin:** elegir passkey/WebAuthn, OTP administrativo o alternativa; definir recuperación. Si se elige passkey no hace falta Brevo.
2. **Metodología definitiva:** escala de posiciones, tratamiento de condiciones, pesos por dimensión y calibración; evaluar con casos reales antes de publicar porcentajes.
3. **Primer corpus:** reunir los seis PDF que ya posee el promotor y comprobar año/edición/condición oficial de cada uno; inventario de históricos opcionales y permisos.
4. **Tratamiento legal proporcional:** textos de aviso/privacidad, logs del VPS, uso de fuentes, cookies administrativas y revisión de publicación del MVP.
5. **Documentos no descargables:** política para enlazar páginas oficiales, extraer HTML autorizado y preservar evidencia sin publicar material protegido.

### No bloqueantes

6. **Nombre y dominio comercial:** pendientes, sin bloquear la arquitectura.
7. **Modelo/proveedor IA concreto:** seleccionar tras pruebas de calidad, coste y capacidad local; JEV experimental.
8. **Número exacto de preguntas por modalidad:** determinar tras medir cobertura y tiempos.
9. **Opciones de exportación adicionales (PDF bonito):** JSON como mínimo; impresión PDF opcional.
10. **Backups:** elegir frecuencia mínima operativa, sin compromisos de alta disponibilidad.
11. **Estadísticas futuras:** diseñar posteriormente si se desean y con qué técnica de anonimización.

## 23. Definition of Done de lanzamiento

- Catálogo accesible, encuesta funcional y resultados reproducibles sin identificación.
- Programas y posiciones incluidos aprobados con fuente primaria, localizador y fecha.
- Cobertura y discrepancias explicables para todos los partidos evaluables; histórico contextualizado.
- Historial local, borrado, exportación/importación y aviso de pérdida de almacenamiento comprobados.
- No cuentas públicas, email/OTP de usuarios, persistencia de resultados en servidor ni transmisión de respuestas en la red (E2E verificado).
- Admin autenticado y procedimientos de recuperación probados.
- Versiones inmutables, tests automáticos, revisión editorial y revisión legal de publicación completadas.
- Despliegue VPS documentado, backup/restauración básica probada, sin dependencias cloud obligatorias.
- Interfaz castellana completa con base i18n preparada.

## Apéndice A. Ejemplo simplificado de salida pública

```json
{
  "surveyReleaseId": "generales-es-2026-r1",
  "scoringModel": "weighted-multidimensional-v1",
  "entity": "entity-123",
  "affinityPercent": 71.4,
  "answeredQuestions": 10,
  "evaluableQuestions": 7,
  "coveragePercent": 70,
  "dimensions": [],
  "evidenceRefs": ["source-42#page=8"],
  "historical": false
}
```

Esta estructura es **local en el navegador** y no es un payload enviado a la API. La fórmula ilustrativa y los números no implican validación estadística.

## Apéndice B. Terminología recomendada

- «Coincidencia documentada» en vez de «tu partido ideal».
- «Cobertura del programa» en vez de «fiabilidad del partido».
- «Sin posición verificable» en vez de «neutral».
- «Referencia histórica» en vez de «candidato» cuando no concursa.
- «Resultados guardados en este navegador» en vez de «tu cuenta».
- «Exportar mis resultados» en vez de «enviarme el informe».

---

**Nota de control de cambios 1.0 → 1.1:** se retiran todas las funciones de usuarios remotos, email público, Brevo obligatorio, OTP visitante, retención de encuestas en backend y S3; se incorporan decisiones 3–7, 11–13; se mantiene carácter pendiente del nombre y de la autenticación administrativa. La estadística global de respuestas pasa explícitamente a fase futura no recolectada.
