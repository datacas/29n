# Privacidad y seguridad

**Fecha:** 2026-11-13  
**Especificación:** v1.1  
**Estado:** Propuesta para validación

---

## 1. Principios de privacidad

### 1.1 Privacy by design

1. **Sin cuentas públicas:** No existe registro, login, email, contraseña ni perfil para visitantes.
2. **Sin respuestas en servidor:** El servidor nunca recibe respuestas, pesos, selección de entidades ni resultados individuales.
3. **Cálculo 100% local:** El scoring se ejecuta en el navegador. El servidor solo entrega datos de releases publicados.
4. **Almacenamiento local:** IndexedDB para historial, progreso y preferencias. El usuario controla borrado.
5. **Exportación manual:** El usuario decide cuándo exportar sus datos. Sin envío automático.
6. **Sin telemetría invasiva:** No hay píxeles de tracking, analítica de comportamiento ni cookies de marketing.

### 1.2 Datos que NO se recopilan

| Dato | Estado |
|---|---|
| Respuestas individuales | ❌ No se recopilan |
| Resultados de scoring | ❌ No se recopilan |
| Selección de entidades | ❌ No se recopilan |
| Historial de encuestas | ❌ Solo en navegador |
| Email de visitantes | ❌ No se solicita |
| Direcciones IP de visitantes | ⚠️ Logs HTTP mínimos, sin asociación con respuestas |
| User-Agent | ⚠️ Logs HTTP mínimos, sin asociación con respuestas |
| Cookies de tracking | ❌ No se usan |
| Perfiles políticos | ❌ No se crean |

### 1.3 Datos que SÍ se almacenan

| Dato | Ubicación | Propósito | Retención |
|---|---|---|---|
| Contenido publicado | PostgreSQL | Encuestas, preguntas, posiciones | Indefinido |
| Documentos originales | Disco local | Fuentes verificables | Indefinido (aceptados) |
| Logs de admin | PostgreSQL | Auditoría de acciones | 1 año |
| Sesiones admin | PostgreSQL | Autenticación | Hasta expiración |
| Credenciales admin | PostgreSQL | Acceso seguro | Hasta revocación |
| Logs HTTP | Disco del VPS | Operación y seguridad | 30 días |

---

## 2. Seguridad de la aplicación

### 2.1 Autenticación administrativa

**Mecanismo elegido:** OTP por email con Brevo gratuito (D-01 confirmada)

**Arquitectura de desafíos OTP:**

El sistema utiliza **desafíos de un solo uso** separados de las sesiones autenticadas. Nunca se almacena el código OTP en texto claro.

**Flujo de autenticación:**

1. **Solicitud:** El admin envía su email a `/api/admin/auth/request`.
2. **Generación:** Se genera un código de 6 dígitos con CSPRNG y un desafío en `admin_otp_challenges`:
   - `challenge_id`: UUID v4 para identificar el desafío.
   - `otp_hash`: HMAC-SHA256(código, secreto_servidor) — **nunca el código en claro**.
   - `attempt_token`: UUID v4 para verificar sin revelar el desafío.
   - `attempts_remaining`: 3 intentos.
   - `expires_at`: 10 minutos desde la creación.
3. **Envío:** Brevo envía el código por email al administrador.
4. **Verificación:** El admin envía el código a `/api/admin/auth/verify` con `attempt_token`:
   - Se calcula HMAC-SHA256(código_enviado, secreto_servidor).
   - Se compara con `otp_hash` almacenado (comparación constante en tiempo).
   - Si coincide: se marca `used_at`, se crea una sesión en `admin_sessions`.
   - Si no coincide: se decrementa `attempts_remaining`.
   - Si `attempts_remaining = 0`: el desafío se invalida.
5. **Sesión:** Se genera un `session_token` en `admin_sessions` con expiración de 24 horas.

**Protecciones:**
- **Código nunca en texto claro:** Solo se almacena `HMAC-SHA256(código, secreto)`.
- **Desafíos separados de sesiones:** `admin_otp_challenges` es independiente de `admin_sessions`.
- **Un solo uso:** Tras verificación exitosa, `used_at` se marca. No se reutiliza.
- **Caducidad:** 10 minutos por desafío.
- **Límite de intentos:** 3 intentos por desafío.
- **Rate limiting:** 3 solicitudes de código por hora por IP.
- **Cookie de sesión:** `HttpOnly`, `Secure`, `SameSite=Strict`.
- **Rotación de sesión:** Cada 24 horas.
- **Protección contra timing attacks:** Comparación HMAC constante en tiempo.
- **Limpieza automática:** Desafíos expirados o usados se eliminan cada hora.

### 2.2 Protección de endpoints

| Endpoint | Autenticación | Rate limiting |
|---|---|---|
| `/api/surveys/*` | Pública | 100 req/min por IP |
| `/api/releases/*` | Pública | 100 req/min por IP |
| `/api/sources/*/metadata` | Pública | 100 req/min por IP |
| `/api/admin/auth/*` | — | 5 req/min por IP |
| `/api/admin/*` | Sesión admin | 30 req/min por sesión |

### 2.3 Validación de uploads

**Validaciones en servidor:**
- MIME type real (inspección de magic bytes, no solo extensión).
- Tamaño máximo: 50 MB.
- Tipo permitido: `application/pdf`, `text/html`.
- Nombre de archivo sanitizado (solo alfanuméricos, guiones, guiones bajos).
- Almacenamiento fuera del directorio público.
- Permisos de archivo: `0600` (solo propietario).

**Protección contra ejecución:**
- Los PDFs se almacenan en carpeta sin permisos de ejecución.
- El worker Python lee los archivos, no los ejecuta.
- No se usan `eval()`, `exec()` ni funciones peligrosas con contenido de uploads.

### 2.4 Protección contra vulnerabilidades OWASP

| Vulnerabilidad | Mitigación |
|---|---|
| SQL Injection | Queries parametrizadas con `knex` o `pg` prepared statements |
| XSS | Escape automático de Vue/Nuxt. CSP headers. No `v-html` sin sanitización. |
| CSRF | SameSite cookies. Validación de Origin header en endpoints admin. |
| IDOR | Verificación de permisos en cada endpoint admin. Sin acceso público a rutas admin. |
| SSRF | Validación de URLs. No seguir redirects. Whitelist de dominios para fuentes. |
| File Upload | Validación MIME, tamaño, nombre. Almacenamiento seguro. Sin ejecución. |
| Session Hijacking | HttpOnly cookies. Secure flag. Rotación de sesión. |
| Brute Force | Rate limiting. Exponencial backoff. Bloqueo temporal. |

### 2.5 Headers de seguridad

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

---

## 3. Privacidad de datos locales

### 3.1 IndexedDB

**Base de datos:** `affinity-survey-local`  
**Almacenes:**
- `sessions`: Sesiones de encuesta en curso.
- `results`: Resultados completados.
- `preferences`: Preferencias de idioma, tema, etc.

**Acceso:**
- Solo desde el origen de la web (same-origin policy).
- El usuario puede borrar datos desde la UI o desde el navegador.

**Avisos al usuario:**
- "Tus respuestas se guardan en este navegador. Se perderán si limpias los datos del navegador, cambias de dispositivo o navegas en modo privado."
- "Exporta tus resultados para conservarlos."

### 3.2 Exportación

**Formato:** JSON versionado.  
**Contenido:**
- `version`: Esquema de exportación (semver).
- `survey_release_id`: Referencia al release.
- `scoring_model_version`: Versión del modelo usado.
- `answers`: Respuestas del usuario.
- `weights`: Pesos asignados.
- `entities`: Entidades seleccionadas.
- `timestamp`: Fecha de exportación.
- `hash`: SHA-256 de integridad.

**Validación al importar:**
- Esquema JSON Schema.
- `survey_release_id` existe en el servidor.
- `hash` coincide con el contenido.
- Tamaño máximo: 10 MB.
- Rechazo de archivos malformados.

### 3.3 Borrado

**Desde la UI:**
- Borrar una encuesta del historial.
- Borrar todo el historial.
- Confirmación explícita.

**Desde el navegador:**
- El usuario puede borrar datos de sitio desde la configuración del navegador.
- No hay recuperación posible.

---

## 4. Cumplimiento legal

### 4.1 RGPD

**Aplicabilidad:** La plataforma procesa datos personales mínimos (solo admin). Los visitantes no proporcionan datos personales.

**Bases jurídicas:**
- **Visitantes:** No se procesan datos personales. Los logs HTTP mínimos son necesarios para la operación del servicio (interés legítimo).
- **Admin:** Consentimiento explícito para acceso administrativo.

**Derechos aplicables:**
- **Visitantes:** No hay datos personales que ejercer derechos sobre.
- **Admin:** Derecho a borrar credenciales y sesiones.

**Obligaciones:**
- Aviso de privacidad visible.
- Política de cookies (solo cookies técnicas de sesión admin).
- Registro de actividades de procesamiento (interno).
- Evaluación de impacto si se añaden estadísticas globales en el futuro.

### 4.2 Cookies

**Cookies usadas:**

| Cookie | Propósito | Tipo | Duración |
|---|---|---|---|
| `admin_session` | Sesión de administración | Técnica, HttpOnly, Secure | 24 horas |
| `i18n_locale` | Preferencia de idioma | Técnica | 1 año |

**Cookies NO usadas:**
- Analytics de terceros.
- Cookies de marketing.
- Cookies de tracking.
- Cookies de sesión para visitantes.

### 4.3 Textos legales necesarios

1. **Aviso legal:** Responsable, finalidad, contacto.
2. **Política de privacidad:** Datos procesados, bases jurídicas, derechos, logs.
3. **Política de cookies:** Cookies técnicas usadas, cómo gestionarlas.
4. **Términos de uso:** Uso del servicio, limitaciones de responsabilidad.

---

## 5. Seguridad operativa

### 5.1 Infraestructura

**VPS:**
- Sistema operativo actualizado (Ubuntu LTS o similar).
- Firewall: solo puertos 22 (SSH), 443 (HTTPS), 80 (HTTP → redirect).
- SSH: clave pública, sin contraseña, puerto no estándar opcional.
- Fail2ban o similar para protección contra brute force.

**TLS:**
- Certificado Let's Encrypt (automático con Caddy).
- Renovación automática.
- HTTP → HTTPS redirect.

**Backups:**
- `pg_dump` semanal de PostgreSQL.
- Copia de `storage/` semanal.
- Almacenamiento: disco local + disco externo opcional.
- Restauración probada al menos una vez.

### 5.2 Secrets management

**Variables de entorno:**
- `DATABASE_URL`: Conexión a PostgreSQL.
- `ANTHROPIC_API_KEY`: Clave de API de Anthropic (proveedor principal).
- `OPENAI_API_KEY`: Clave de API de OpenAI (fallback).
- `STORAGE_PATH`: Ruta de almacenamiento de documentos.
- `WORKER_SCRIPT`: Ruta del script del worker.

**Almacenamiento:**
- Variables en `.env` del servidor (no en repositorio).
- `.env` en `.gitignore`.
- No hardcodear secretos en código.

### 5.3 Logs

**Qué se registra:**
- Acciones de admin (login, logout, CRUD, publicación).
- Errores de aplicación (stack trace sin datos sensibles).
- Trabajos del worker (job_id, estado, duración).
- Errores de LLM (sin prompts ni responses).

**Qué NO se registra:**
- Respuestas de usuarios.
- Resultados de scoring.
- Contenido de preguntas en logs de acceso.
- Prompts o responses del LLM (solo en modo debug).

**Retención de logs:**
- Logs de aplicación: 30 días.
- Logs de auditoría admin: 1 año.
- Logs HTTP: 30 días.

---

## 6. Estadísticas globales (futuro)

**Estado actual:** No implementadas. Sin puerta trasera de envío de respuestas.

**Consideraciones para el futuro:**
- Cualquier estadística requerirá:
  - Diseño específico de anonimización.
  - Evaluación de protección de datos.
  - Participación voluntaria del usuario.
  - Técnica de agregación que no permita reconstruir respuestas individuales.
  - Posible uso de privacidad diferencial.
- **No instrumentar recolección hasta diseño específico aprobado.**

---

## 7. Checklist de seguridad pre-lanzamiento

- [ ] Certificados TLS configurados y renovación automática.
- [ ] Headers de seguridad verificados.
- [ ] Rate limiting activo en endpoints admin.
- [ ] Validación de uploads probada con archivos maliciosos.
- [ ] Queries parametrizadas en todas las operaciones BD.
- [ ] CSP headers configurados y verificados.
- [ ] Sesiones admin con HttpOnly, Secure, SameSite.
- [ ] Rate limiting probado con ataque simulado.
- [ ] Backup y restauración probados.
- [ ] Logs verificados: sin respuestas de usuarios.
- [ ] Textos legales publicados (aviso, privacidad, cookies, términos).
- [ ] Revisión de dependencias: sin vulnerabilidades conocidas.
- [ ] Variables de entorno: sin secretos en repositorio.
- [ ] Firewall configurado: solo puertos necesarios.
- [ ] SSH seguro: clave pública, sin contraseña.
