# Propuesta técnica: área online de evaluación metodológica de 29N (SOLO PROPUESTA; nada implementado ni desplegado)

Fecha: 2026-11-25. **Sustituye** a `propuesta-interfaz-evaluacion-humana.md` (opciones de paquete HTML, descartadas por el responsable). Objetivo: una herramienta **permanente** de evaluación humana ciega, con acceso por correo autorizado y OTP (Brevo), persistencia directa en PostgreSQL, cierre irreversible, adjudicación separada y métricas automáticas, reutilizable en el piloto de 19 celdas, en la campaña de ~150 y en futuras campañas.

El piloto de 19 celdas es una **muestra dirigida** (casos conflictivos e informativos): sus métricas no se extrapolan al banco ni sustituyen a la campaña de ~150 celdas; no es una validación científica global de 29N.

## 1. Punto de partida (verificado en el código y en la infraestructura)
| Hecho | Detalle | Consecuencia |
|---|---|---|
| Autenticación existente | `request-otp`/`verify-otp` con OTP de 6 dígitos (HMAC), caducidad, uso único y 3 intentos; sesión en cookie (`admin_session`). Un **único** correo (`adminEmail`). `requireAdmin` devuelve `void`: **no identifica a la persona**. Límite de peticiones: máx. 3 desafíos vivos por correo; **sin límite por IP**, sin auditoría de accesos | Reutilizar la lógica (OTP, Brevo, sesiones) pero con tablas y comprobaciones nuevas; no abrir el panel actual a terceros |
| Correo | `BrevoAdapter` (API transaccional de Brevo) con respaldo `MockEmailAdapter` | Reutilizable tal cual; hace falta remitente y clave en el entorno de despliegue |
| Panel administrativo | Excluido del build público (`DEPLOY_TARGET=public`); el build público responde 404 a todo `/api` salvo las estadísticas anónimas (`01-public-lockdown.ts`) | El área de evaluación necesita **su propio destino de despliegue**; no se mezcla con el sitio público |
| Bases de datos | Postgres local (Docker) con el banco completo; **Neon** (proyecto `Elecciones29N`, región `aws-eu-west-2`) con solo `usage_events` y `contribution_tallies`; límite lógico de 1 GiB por rama y **6 h de historial** (plan gratuito) | Neon ya está conectado a Vercel y sirve para el área online; sus copias son cortas: hay que hacer copias propias |
| Vercel | Proyecto `29n` en el equipo personal; `vercel.json` desactiva los despliegues de las ramas `methodology-*` | Un segundo proyecto de Vercel aislaría la evaluación; **nada se despliega sin autorización expresa** |
| `position_codings` (migración 009) | Solo añadir, clase/intensidad/estado técnico coherentes, `evaluator_kind = human`, `blind` | Destino final de las evaluaciones humanas cerradas |
| `jev-labeling` | Pantalla de etiquetado ciego (progreso, navegación, atajos, borrador); guarda en un JSON | Se reutilizan sus patrones de interfaz; no su almacenamiento |
| Métricas | `agreement.mjs`, `benchmark_analyze.mjs` (alfa nominal/ordinal, kappa ponderado, Gwet AC1/AC2, IC) | Se reutilizan; humano–humano, humano–IA e IA–IA por separado |

## 2. Arquitectura objetivo
Dos superficies con **permisos de base de datos distintos**:

1. **Aplicación de evaluación (pública, mínima)**: solo `/evaluacion` y `/api/eval/*`. Es lo único que se despliega. Acceso por correo autorizado + OTP. Dos perfiles en el servidor: `evaluator` y `admin`.
2. **Panel de administración (local)**: gestiona evaluadores, campañas, asignaciones, progreso, adjudicación y métricas, conectándose a la base de evaluación con credencial de administración. **No se despliega** ni se expone el panel completo de 29N.

Una **base de datos de evaluación separada** (Neon, base o rama nueva) que contiene **solo**: usuarios autorizados, sesiones y OTP, campañas, instantáneas de celdas (pregunta, contexto y pasajes públicos de los programas con su página, etiqueta ciega de partido), asignaciones, borradores, evaluaciones finalizadas, adjudicaciones y auditoría. **No contiene** el banco completo, las posiciones, la referencia provisional ni las respuestas de ninguna IA: aunque se comprometiera la aplicación, esos datos no están allí.

```
Evaluador ──HTTPS──▶ App de evaluación (Nuxt, destino 'evaluation') ──TLS, rol eval_app──▶ Neon (BD evaluacion)
                          │                                                                  ▲
                          └── OTP por correo ──▶ Brevo                                       │ rol eval_admin (solo desde tu equipo)
Administrador (local) ───────── panel local de 29N ───────────────────────────────────────────┘
                                   │  adjudicación y métricas con la referencia y las IA, que SOLO existen en la BD local
                                   ▼
                         Postgres local: position_codings (humanas cerradas se copian aquí con un script de «pull»)
```
Flujo de datos: (1) el panel local publica una campaña (celdas ciegas) en Neon; (2) los evaluadores trabajan online; (3) al cerrarse, un script copia las evaluaciones finalizadas a `position_codings` local; (4) la adjudicación y las métricas se hacen **en local**, donde viven la referencia y las salidas de IA.

## 3. Alternativas de alojamiento
| | **H1. Vercel (2.º proyecto) + Neon** | H2. VPS propio (Nuxt + Postgres + HTTPS) | H3. Servidor local + túnel | H4. Mismo proyecto Vercel público |
|---|---|---|---|---|
| Coste | 0 € (Hobby, Neon gratuito, Brevo gratuito) | El del VPS que ya tengas + tu tiempo de mantenimiento | 0 € | 0 € |
| Esfuerzo inicial | Bajo (ya hay Vercel, Neon y Brevo) | Medio-alto (sistema, proxy, TLS, parches, copias) | Bajo | Bajo |
| Superficie expuesta | Solo la app de evaluación; BD aislada | Servidor completo bajo tu responsabilidad | Tu equipo de trabajo | Mezclada con el sitio electoral |
| Disponibilidad | Alta, sin gestión | La de tu VPS | Depende de que tu equipo esté encendido | Alta |
| Copias y recuperación | Neon (6 h) + `pg_dump` programado | Las que montes tú | Las locales existentes | — |
| Reutilización | Neon, Vercel y Brevo ya configurados | Brevo; el resto nuevo | Todo local | — |
| Veredicto | **Recomendada** | Alternativa si prefieres una sola infraestructura propia | No recomendada | **Descartada** (mezcla con el tráfico electoral y el build público) |

Descartadas por el responsable: exponer PostgreSQL, exponer el panel administrativo completo y los paquetes HTML offline.

**Pendientes que dependen de ti** (no puedo verificarlos): condiciones de uso no comercial del plan Vercel Hobby para este uso; si tienes un dominio para un subdominio (si no, `*.vercel.app` es gratuito con HTTPS); y, solo si eliges H2, proveedor, sistema y recursos del VPS.

## 4. Autenticación y sesiones (reutilizando el código existente)
Tablas nuevas en la BD de evaluación (`eval_users`, `eval_sessions`, `eval_otp_challenges`, `eval_rate_limits`, `eval_audit`); **no** se reutilizan los datos de `admin_credentials`.
1. El evaluador escribe su correo. Respuesta idéntica y con tiempo similar exista o no (no hay enumeración).
2. Si está autorizado y activo, se genera un OTP de un solo uso (HMAC, caducidad corta, intentos limitados) y se envía con Brevo.
3. El servidor verifica el OTP y crea una sesión: cookie `__Host-` con `HttpOnly`, `Secure`, `SameSite=Strict`, duración limitada.
Añadidos respecto a hoy: límite de peticiones **por correo y por IP** (tabla en Postgres, sin servicios extra), revocación inmediata de sesiones al desactivar a un usuario, cierre de sesión, auditoría de accesos y de intentos fallidos, comprobación de `Origin` contra CSRF y cabeceras de seguridad (CSP, `noindex`).
Autorización **en el servidor**: `requireEvaluator(event)` devuelve la identidad (`userId`, correo, rol, tipo interno/externo) y toda consulta filtra por esa identidad y por la asignación de campaña. Se corrige además que `requireAdmin` del panel local devuelva la identidad.

## 5. Permisos
Dos roles, sin RBAC genérico. El administrador de la aplicación online solo puede gestionar usuarios y campañas desde el **panel local** (no hay página de administración desplegada); en la aplicación online, el administrador que también evalúa lo hace como `evaluator`.
| Acción | `admin` (panel local) | `evaluator` (online) |
|---|---|---|
| Gestionar correos autorizados, interno/externo, activar o revocar | Sí | No |
| Crear, asignar y cerrar campañas | Sí | No |
| Ver sus tareas, guardar borradores, finalizar evaluaciones propias | Sí (como evaluador) | Sí |
| Ver evaluaciones ajenas | Solo tras su propio cierre y el de los demás, o el cierre formal de la campaña | No |
| Resultados y métricas | Sí | No |
| Adjudicar | Sí, tras el cierre | No |
| Modificar preguntas, posiciones, releases o scoring | No desde esta herramienta | No |

## 6. Ceguera
- Las respuestas de la API se construyen con una **lista blanca de campos** (pregunta, contexto, pasajes con página, manual, estado del propio evaluador). No incluyen referencia, respuestas de IA, evaluaciones ajenas, identificadores que revelen el partido ni datos de adjudicación.
- El partido se sustituye por una etiqueta estable por campaña; el diccionario etiqueta ↔ partido vive en una tabla **solo legible por `eval_admin`** (el rol de la aplicación no tiene permiso).
- No se modifican las citas originales; si el texto delata al partido, se documenta.
- Pruebas automáticas recorren las respuestas JSON en busca de claves o valores prohibidos.

## 7. Persistencia y modelo de datos (borrador de la migración para la BD de evaluación)
| Tabla | Contenido y reglas |
|---|---|
| `eval_users` | correo único, `role` (`admin`/`evaluator`), `affiliation` (`internal`/`external`), `active`, fechas |
| `eval_campaigns` | nombre, método de selección (para documentar el sesgo), estado (`draft`/`open`/`closed`), versión del manual |
| `eval_cells` | instantánea inmutable: pregunta, contexto, pasajes (texto y página), etiqueta ciega, huella; versión (las ampliaciones de contexto crean una versión nueva visible a **todos** los evaluadores de la celda) |
| `eval_assignments` | celda × evaluador |
| `eval_drafts` | borrador mutable con `version` (concurrencia optimista: «If-Match»), clase, intensidad, evidencias seleccionadas, justificación, «contexto insuficiente» |
| `eval_submissions` | evaluación **finalizada**, solo añadir (disparadores UPDATE/DELETE/TRUNCATE), coherencia clase↔intensidad como en `position_codings`, `revision` para reevaluaciones autorizadas (la original se conserva) |
| `eval_adjudications` | decisión, motivo y autor, solo añadir; solo se puede crear si todos los evaluadores de la celda han cerrado o la campaña está cerrada |
| `eval_audit`, `eval_rate_limits` | accesos, cambios de estado y límites; solo añadir |
Al finalizar, la evaluación se registra **en una transacción**: borrador → `eval_submissions` y bloqueo del borrador. El «pull» copia las finalizadas a `position_codings` local (`evaluator_kind = human`, `blind = true`, `independent_of` rellenado con los demás evaluadores).

Roles de PostgreSQL con mínimos privilegios: `eval_app` (solo sus tablas operativas, sin acceso a la tabla de etiquetas ni a adjudicaciones) y `eval_admin` (solo desde tu equipo).

## 8. Interfaz del evaluador (`/evaluacion`)
Campañas asignadas e instrucciones; progreso; navegación y atajos (patrón de `jev-labeling`); pregunta, contexto, manual y pasajes con página; cinco clases documentales; intensidad cuando procede; selección de las evidencias que justifican la decisión; justificación; «contexto insuficiente» con petición de contexto; guardado automático; continuar desde cualquier dispositivo; revisión de pendientes; finalizar cada evaluación y la campaña. **Petición de contexto adicional**: el evaluador marca la insuficiencia y escribe qué necesita; el administrador (en local) decide si añade pasajes y, si lo hace, se crea una versión nueva de la celda visible a todos los evaluadores, con registro de auditoría.

## 9. Métricas y adjudicación (local)
Servicio de métricas sobre `position_codings` y las evaluaciones cerradas: alfa de Krippendorff nominal y ordinal, kappa ponderado, Gwet AC1/AC2, IC por bootstrap, acuerdo exacto, MAD y discrepancias de signo, **separados** en humano–humano, humano–IA e IA–IA, distinguiendo evaluadores internos y externos. Cada informe imprime el método de selección y su sesgo. La pantalla de adjudicación exige que el administrador haya cerrado antes su propia evaluación y solo muestra las respuestas ajenas tras el cierre.

## 10. Plan de pruebas
Unitarias y de integración contra una BD temporal (como las de la migración 009), más pruebas de extremo a extremo con Playwright: OTP (caducidad, uso único, intentos, límites por correo e IP), correos no autorizados y evaluadores desactivados, revocación de sesiones, separación `admin`/`evaluator`, acceso a campañas y evaluaciones ajenas, **fugas que rompan la ceguera**, guardado automático y ediciones concurrentes, finalización irreversible, inmutabilidad de `position_codings`/`eval_submissions`, separación evaluación/adjudicación, compatibilidad de versiones del manual y de las celdas, auditoría de accesos y respuestas idénticas ante correos inexistentes.

## 11. Fases y esfuerzo (estimaciones mías, a confirmar)
| Fase | Contenido | Esfuerzo |
|---|---|---|
| 0 | Decidir alojamiento, dominio, retención y evaluadores | Decisión |
| 1 | Migración de la BD de evaluación, autenticación OTP con identidad, API y pantalla del evaluador, tests | 3–4 días |
| 2 | Panel local: evaluadores, campañas, asignaciones, progreso, publicación y «pull» | 2 días |
| 3 | Adjudicación, métricas separadas, exportación e informes | 2 días |
| 4 | Despliegue (proyecto Vercel nuevo + Neon) con copias programadas, **solo tras autorización expresa** | 0,5–1 día |
Hasta la fase 4 todo funciona en local y por PR hacia `methodology-integration`, sin despliegues.

## 12. Riesgos y mitigaciones
- **Datos personales (correos de evaluadores):** minimización (solo el correo y una etiqueta), acceso restringido, retención definida y borrado a petición; informar a los colaboradores del tratamiento.
- **Copias:** el plan actual de Neon conserva 6 h; añadir `pg_dump` programado hacia local.
- **Disponibilidad durante el 29-nov:** el sitio público sigue en su proyecto; la evaluación va aparte y no comparte despliegue.
- **Coste:** sin servicios de pago; si Brevo, Vercel o Neon exigieran un plan de pago, se vuelve a consultar.
- **Alcance:** esta herramienta no modifica preguntas, posiciones, scoring ni releases.

## 13. Decisiones pendientes (una cada vez)
1. Alojamiento: **H1** (recomendada) o H2.
2. Dominio o subdominio (o `*.vercel.app`).
3. Panel de administración **local** conectado a la BD de evaluación (recomendado) o página de administración también online.
4. Retención y copias de la BD de evaluación.
5. Lista inicial de evaluadores (correo y tipo interno/externo) y remitente de Brevo.
6. Autorización para empezar la fase 1 (código y tests, sin desplegar).

## 14. Restricciones vigentes
Benchmarks A y B cerrados (D19); sin nuevas llamadas a modelos; conjunto E sellado; sin tocar producción, banco de preguntas, scoring, posiciones adjudicadas ni el release 2.1.2; trabajo por PR hacia `methodology-integration` sin despliegues de Vercel; sin servicios de pago sin aprobación.
