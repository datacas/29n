# Propuesta técnica simplificada: evaluación humana ciega en el panel administrativo local (SOLO PROPUESTA; nada implementado)

Fecha: 2026-11-25. **Sustituye** a `propuesta-area-online-evaluacion.md` (alojamiento online, OTP y BD de evaluación en Neon), que el responsable descarta porque realizará personalmente las evaluaciones humanas desde el entorno local y no dispone ahora de colaboradores externos. También sustituye a `propuesta-interfaz-evaluacion-humana.md` (paquetes HTML). Ambas se conservan como registro de alternativas evaluadas.

## 1. Alcance
**Se hace:** una pantalla de evaluación humana ciega integrada en el panel administrativo **local** existente, con campañas, asignaciones, selección de evidencias, justificación, «contexto insuficiente», guardado automático de borradores en PostgreSQL local, finalización irreversible (a `position_codings`, solo añadir) y adjudicación; métricas reutilizando las ya implementadas.

**No se hace** (decisión expresa): sin cambios en el proyecto Vercel actual ni segundo proyecto; sin segunda base de datos Neon; sin sincronización entre bases; sin OTP adicional ni accesos externos; sin paquetes HTML ni importaciones manuales; sin despliegue alguno. Producción, release 2.1.2, scoring, banco de preguntas, conjunto E y benchmarks A y B (cerrados, D19) permanecen intactos.

## 2. Qué se reutiliza (y qué cambia)
| Componente | Uso | Cambio necesario |
|---|---|---|
| Panel administrativo local (`app/pages/admin`, `layouts/admin.vue`, `admin.css`) | Aloja las pantallas nuevas con su menú y estilo | Una entrada de menú nueva |
| `/admin/jev-labeling` | Patrón de interfaz: progreso, navegación, atajos de teclado, guardado | Copiar y adaptar la página; el almacenamiento en JSON se sustituye por PostgreSQL |
| `requireAdmin` | Autenticación del administrador (tú) | Que **devuelva la identidad** (`credentialId`, correo); es compatible con los usos actuales, que ignoran el valor |
| `position_codings` (migración 009) | Destino de las evaluaciones finalizadas (`evaluator_kind = human`) | Ampliar el `CHECK` de `execution_status` con `insufficient_context` (aditivo) y guardar los extras en `config` |
| `agreement.mjs`, `benchmark_analyze.mjs` | Alfa nominal y ordinal, kappa ponderado, Gwet AC1/AC2, IC, acuerdo exacto, MAD, discrepancias de signo | Moverlas a un módulo compartido (`app/lib/methodology`) importable por el servidor y por los scripts |
| Paquete de B (`benchmark_pack_B_S.json`) y `coding-manual-v0.md` | Contenido de las celdas ciegas y manual mostrado | Un script de creación de campañas |
| `editorial_audit` | Registro de auditoría de acciones | Nuevos tipos de acción |
| `build_adjudication_sheets.mjs` | Sabe qué celdas son prioritarias | Se sustituye por la pantalla; el script de creación de campaña lee la misma selección |

## 3. Modelo de datos (migración 010, **solo BD local**, con backup previo y prueba en BD temporal como la 009)
Preparado para evaluadores externos futuros **sin implementar su acceso**: toda autorización recibe una identidad de evaluador resuelta por una función, y hoy esa función devuelve «el administrador autenticado = evaluador interno». Más adelante bastaría añadir otra forma de resolver la identidad (por ejemplo OTP) sin tocar el modelo ni la lógica.

| Tabla | Contenido y reglas |
|---|---|
| `eval_evaluators` | `id`, `label` (p. ej. «Humano interno 1»), `affiliation` (`internal` / `external`), `active`, `email` opcional y `credential_id` opcional (vínculo con `admin_credentials`) |
| `eval_campaigns` | nombre, **método de selección y sesgo documentado**, estado (`draft`/`open`/`closed`), versión del manual, fechas |
| `eval_cells` | `campaign_id`, referencia a la celda, **instantánea ciega inmutable** (pregunta, contexto, pasajes con página, etiqueta ciega del partido), huella, `version` (las ampliaciones de contexto crean una versión nueva). El diccionario etiqueta ↔ partido va en una columna aparte que **ninguna consulta de evaluación lee** |
| `eval_assignments` | celda × evaluador |
| `eval_drafts` | borrador mutable con `version` (concurrencia optimista): clase, intensidad, evidencias seleccionadas, justificación, «contexto insuficiente» |
| `eval_adjudications` | decisión, motivo, autor; solo añadir; solo se crea tras el cierre de la evaluación propia (y, con varios evaluadores, tras el cierre de todos o de la campaña) |
| `eval_context_requests` | petición de contexto adicional y su resolución; el administrador añade pasajes → nueva versión de la celda |
| `eval_audit` | acciones relevantes (solo añadir) |
Las evaluaciones **finalizadas** no se guardan en una tabla propia: se escriben en `position_codings` (`evaluator_kind = human`, `blind = true`, `config = {affiliation: 'internal', campaign_id, evidencias seleccionadas, revision}`). Una reevaluación autorizada es una **fila nueva** (`revision` + 1); la original se conserva. Esto también permite medir la **repetibilidad de un mismo evaluador** (test–retest).

## 4. Interfaz y flujo
1. **`/admin/evaluacion`:** campañas, progreso, pendientes y finalizadas.
2. **`/admin/evaluacion/[campaña]`:** pantalla de evaluación (patrón de `jev-labeling`): pregunta, contexto, manual y pasajes con página; cinco clases documentales; intensidad cuando procede; selección de las evidencias que justifican la decisión; justificación; «contexto insuficiente» con petición de contexto; guardado automático (con control de versión); navegación y atajos; finalizar cada evaluación y la campaña.
3. **Finalización irreversible:** una transacción copia el borrador a `position_codings`, bloquea el borrador y registra la auditoría. A partir de ahí la evaluación no se puede editar.
4. **`/admin/evaluacion/[campaña]/adjudicar`:** solo accesible cuando **tu propia evaluación de esa celda está finalizada** (lo comprueba el servidor). Muestra la referencia provisional y las respuestas de las IA y permite registrar la adjudicación.
5. **`/admin/evaluacion/informe`:** métricas y limitaciones (apartado 6).

## 5. Ceguera (garantizada en el servidor)
- Las APIs de evaluación leen **solo** `eval_cells` (la instantánea ciega) y los borradores/evaluaciones del evaluador autenticado. Nunca consultan `positions`, `position_codings` de otros evaluadores, la referencia ni las salidas de IA.
- Respuestas construidas con **lista blanca de campos**; pruebas automáticas recorren el JSON en busca de claves o valores prohibidos.
- El partido se sustituye por una etiqueta; se documenta que los pasajes pueden delatarlo y que **tú ya conoces el proyecto y has visto parte de los resultados**, por lo que la ceguera es parcial.
- Las APIs de adjudicación devuelven 403 hasta que la evaluación propia de la celda esté finalizada.

## 6. Metodología e informes
- **Etiqueta fija:** tus evaluaciones son **«humanas internas»** (`affiliation = internal`). **No son una referencia humana independiente**: tú diseñaste el sistema y tomaste decisiones editoriales previas.
- **Métricas que se informan:** IA–IA (como hasta ahora) y **humano interno–IA**, con alfa de Krippendorff nominal (clase) y ordinal (intensidad), kappa ponderado, Gwet AC1/AC2, IC por bootstrap, acuerdo exacto, MAD y discrepancias de signo; clase e intensidad por separado.
- **Qué NO se afirma:** no se informa concordancia humano–humano independiente ni se presenta 29N como validado. Cada informe imprime esta limitación y el **sesgo de selección** de la muestra (las 19 celdas se eligieron por ser conflictivas o informativas; no se extrapolan al banco).
- La concordancia humano–humano solo se calculará si en el futuro hay ≥2 evaluadores de afiliación externa; la repetibilidad del mismo evaluador interno se informará aparte.
- Piloto de 19 celdas primero; la campaña de ~150 celdas se valorará después con sus resultados.

## 7. Estimación de esfuerzo actualizada (mía, a confirmar)
| Tarea | Días |
|---|---|
| Migración 010 + prueba en BD temporal + backup; ampliar el `CHECK` de `execution_status` | 0,5 |
| `requireAdmin` con identidad; utilidades de evaluación (DTO ciego, transacción de finalización, versionado) | 0,75 |
| APIs de evaluación (campañas, celdas, borrador, finalizar, contexto) | 1 |
| Pantalla de evaluación (adaptando `jev-labeling`) y menú | 1 |
| Script de creación de campaña desde el paquete de B (las 19 celdas) | 0,5 |
| **Subtotal para empezar el piloto** | **≈ 3,75** |
| Adjudicación (APIs y pantalla, con control de acceso) | 1 |
| Módulo de métricas compartido, informe humano interno–IA e IA–IA con las limitaciones | 1 |
| Pruebas de ceguera, finalización irreversible, inmutabilidad, concurrencia, control de acceso y auditoría; documentación | 1 |
| **Total** | **≈ 6,75 días** |
Frente a las propuestas anteriores (7,5–9 días y despliegue), se eliminan autenticación OTP, segunda base, sincronización, alojamiento y copias. Sin cambios en producción y sin despliegues.

## 8. Riesgos y límites
- **Ceguera parcial** por ser el mismo diseñador quien evalúa (documentado; no es independencia).
- **n pequeño** (19): detecta problemas del manual y del procedimiento; no acredita fiabilidad.
- Toda la información queda en la BD local: las copias dependen de `scripts/backup-db.sh` (hacer una copia antes de cada migración y de cada campaña).
- La interfaz solo es accesible mientras el panel local esté en marcha.

## 9. Decisiones pendientes
1. ¿Se aprueba empezar por el **subtotal del piloto** (migración, APIs, pantalla y campaña de 19 celdas) y dejar adjudicación y métricas para después?
2. ¿El nombre de tu evaluador es «Humano interno 1» o prefieres otra etiqueta?
3. ¿Las 19 celdas son las ya identificadas (10 prioritarias + 3 posibles omisiones + 15 de la regla pre-registrada, con solapes) o quieres ajustarlas?

## 10. Restricciones vigentes
Sin cambios en Vercel ni Neon; sin nuevas llamadas a modelos; E sellado; sin tocar producción, banco, scoring, posiciones adjudicadas ni el release 2.1.2; trabajo por PR hacia `methodology-integration` sin despliegues; sin servicios de pago.
