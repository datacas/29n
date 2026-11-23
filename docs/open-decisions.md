# Decisiones pendientes y recomendaciones

**Fecha:** 2026-11-13  
**Especificación:** v1.1  
**Estado:** Para discusión con el promotor

---

## 1. Decisiones bloqueantes

### D-01: Mecanismo de autenticación administrativa

**Estado:** ✅ **Confirmada: OTP por email con Brevo gratuito.**

**Decisión:** Autenticación administrativa mediante código OTP de 6 dígitos enviado por email, utilizando Brevo en su plan gratuito.

**Justificación:**
- Familiar para administradores no técnicos.
- Funciona en cualquier dispositivo con acceso al correo.
- Recuperación natural: nuevo código al mismo buzón.
- Brevo gratuito: 100 emails/día suficiente para uso administrativo.
- Sin dependencia de hardware especial (llaves de seguridad, biometría).

**Implementación propuesta:**
- Proveedor SMTP: Brevo (plan gratuito).
- Código OTP: 6 dígitos, caducidad 10 minutos.
- Límite de intentos: 5 intentos fallidos → bloqueo 15 minutos.
- Sesión: cookie `HttpOnly`, `Secure`, `SameSite=Strict` con rotación cada 24 horas.
- **Solo para administración.** Sin cuentas, email ni registro para visitantes.

**Seguridad:**
- Rate limiting en endpoint de login.
- Registro de intentos fallidos en `editorial_audit`.
- Notificación por email al iniciar sesión desde nueva IP.
- Códigos de un solo uso: el OTP se invalida tras su primer uso exitoso.

---

### D-02: Fórmula multidimensional de scoring y calibración de prioridades

**Estado:** ✅ **Confirmada: Scoring multidimensional mediante media ponderada de dimensiones.**

**Decisión:** El modelo es compatibilidad ponderada y multidimensional desde el MVP. La fórmula de agregación entre dimensiones es una **media ponderada de dimensiones** con pesos configurables y positivos.

**Modelo funcional aprobado:**
- La ponderación funciona **dentro de cada dimensión** (pesos del usuario por pregunta: baja=0.5, media=1.0, alta=2.0).
- La agregación entre dimensiones usa una **media ponderada** con pesos por dimensión `λ_d` (Σ λ_d = 1).
- Fórmula global: `C_p = 100 × Σ_{d: D_{pd}≠∅} λ_d × avg_s_{pd}`.
- Pesos iguales por defecto (equivalente a media simple), salvo configuración distinta del administrador.
- Tres modos de calibración: seria, rápida y omitida.
- Excluir posiciones sin evidencia del numerador y denominador.
- Mostrar cobertura global y por dimensión.
- **Sin umbral mínimo obligatorio** de cobertura.

**Calibración seria:** Comparaciones por pares entre dimensiones, con selección adaptativa y reproducible. Algoritmo determinista, versionado, ejecutado íntegramente en el navegador. Debe admitir empates y omisiones, equilibrar la exposición de las dimensiones y generar pesos positivos normalizados.

**Calibración rápida:** Asignación baja/media/alta a cada dimensión. Los pesos se normalizan: `λ_d = w_d / Σ w_d`.

**Calibración omitida:** Se usan pesos predeterminados configurados por el administrador. Por defecto, pesos iguales.

**Algoritmo matemático específico de calibración seria:** Sigue sujeto a validación técnica (SPIKE-11). El modelo funcional (media ponderada con tres modos de calibración) está aprobado y puede implementarse.

**Documentación detallada:** Ver `scoring-methodology.md`, sección 4, con fórmula, sistema de calibración, ejemplos y pruebas de sensibilidad.

---

## 2. Decisiones de nivel medio

### D-03: Esquema de exportación/importación

**Estado:** Pendiente de detalle. Necesario para H3.

**Propuesta:**

```json
{
  "version": "1.0.0",
  "survey_release_id": "generales-es-2026-r1",
  "scoring_model_version": "weighted-multidimensional-v1",
  "entities": ["entity-123", "entity-456"],
  "depth_mode": "normal",
  "answers": [
    { "question_id": "q-001", "value": 2, "skipped": false },
    { "question_id": "q-002", "value": null, "skipped": true }
  ],
  "weights": [
    { "question_id": "q-001", "importance": "high" },
    { "question_id": "q-002", "importance": "medium" }
  ],
  "timestamp": "2026-11-13T10:30:00Z",
  "hash": "sha256:..."
}
```

**Validación al importar:**
- Esquema JSON Schema con versión.
- `survey_release_id` existe en servidor.
- `hash` coincide con SHA-256 de `answers + weights + release_id`.
- Tamaño máximo: 10 MB.
- Rechazo de archivos malformados.

---

### D-04: Configuración de LLM para MVP

**Estado:** ✅ **Confirmada: Anthropic (principal) + OpenAI (fallback).**

**Decisión:** El pipeline documental usa una arquitectura multiproveedor configurable por tarea con dos proveedores API: **Anthropic (Claude)** como proveedor principal y **OpenAI** como fallback automático. Ollama queda excluido temporalmente del proyecto.

**Flujo del pipeline:**
1. **Anthropic (Claude)** — Proveedor principal.
2. Error recuperable (timeout, 5xx, 429, conexión) → **OpenAI** — Fallback automático.
3. **Validación y revisión editorial** — Ninguna propuesta se publica automáticamente.

**Arquitectura multiproveedor:**
- Interfaz común `LLMProvider` con métodos `complete()`, `complete_json()`.
- Configuración por tarea: extracción, verificación, clasificación.
- Cada tarea define provider, modelo, temperatura, timeout y límites de tokens.
- Los prompts se versionan y registran para trazabilidad.
- Fallback automático **solo ante errores recuperables** (timeouts, errores transitorios, indisponibilidad).
- **No se activa fallback** por respuestas semánticamente incompletas o incorrectas; estas siguen el circuito de validación y revisión editorial.

**Proveedor principal: Anthropic (Claude)**
- Modelo: `claude-sonnet-4-20250514` para extracción y verificación.
- Modelo: `claude-haiku-20250414` para clasificación (más rápido y económico).
- Temperatura baja (0.1) para consistencia en extracción.
- Temperatura 0.0 para verificación determinista.
- Credencial: `ANTHROPIC_API_KEY`.

**Proveedor de fallback: OpenAI**
- Modelo: `gpt-4o-mini` para todas las tareas (equilibrio coste/calidad).
- Credencial: `OPENAI_API_KEY`.
- Se activa solo ante errores recuperables de Anthropic.

**Ollama excluido:**
- Ollama no se mantiene como dependencia del MVP.
- La arquitectura multiproveedor permite reincorporarlo en el futuro sin reescribir el pipeline.

**Justificación:**
- Anthropic (Claude) ofrece alta calidad en extracción de texto estructurado y razonamiento.
- OpenAI como fallback garantiza disponibilidad ante indisponibilidad de Anthropic.
- Arquitectura multiproveedor permite cambiar de proveedor sin modificar el código del pipeline.
- La elección definitiva de modelo se basará en resultados con documentos reales.
- Sin dependencias locales (Ollama) para simplificar despliegue y mantenimiento.

**Configuración por tarea:**
- Extracción: Anthropic claude-sonnet-4, temperatura 0.1 → fallback OpenAI gpt-4o-mini.
- Verificación: Anthropic claude-sonnet-4, temperatura 0.0 → fallback OpenAI gpt-4o-mini.
- Clasificación: Anthropic claude-haiku, temperatura 0.1 → fallback OpenAI gpt-4o-mini.

**Registro de cada intento:**
Cada llamada LLM registra en `document_jobs.metadata`:
- Proveedor usado (anthropic, openai).
- Modelo exacto.
- Versión del prompt.
- Duración en milisegundos.
- Tokens consumidos.
- Error y resultado (éxito/fallo).
- Lista de intentos con proveedor, modelo, duración y error de cada uno.

**Gestión de credenciales:**
- `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` mediante variables de entorno.
- Sin valores hardcodeados en el código.
- Sin credenciales en `.env` de ejemplo.

---

### D-05: Comunicación con worker documental

**Estado:** Pendiente de detalle. Necesario para H1.

**Opciones:**

| Opción | Descripción | Ventajas | Desventajas |
|---|---|---|---|
| **A: Proceso hijo** | Nuxt invoca script Python con `child_process`/`execa` | Más simple, sin servicio adicional | Bloqueante si el script es lento, sin reintentos automáticos |
| **B: Servicio separado** | Worker Python como servicio independiente con cola en BD | Más robusto, reintentos, escalabilidad | Más complejo, otro servicio que mantener |

**Recomendación:** **Opción A (proceso hijo)** para MVP.

**Justificación:**
- Simplifica despliegue: un solo servicio adicional (no un servicio persistente).
- El admin inicia el job manualmente, no es un proceso en tiempo real.
- El script Python se ejecuta en segundo plano (desenlazado).
- El estado se actualiza en BD por el worker.
- Se migra a servicio separado si la carga lo requiere.

**Implementación propuesta:**
- Endpoint `POST /api/admin/sources/:id/process` inicia el script con `execa`.
- El script se ejecuta en segundo plano (desenlazado).
- El worker actualiza `document_jobs` en BD con estados.
- El admin ve el estado con polling cada 5 segundos.

---

### D-06: Umbral de advertencia de cobertura

**Estado:** Pendiente de detalle. Necesario para H4.

**Decisión aprobada:** **No existe umbral mínimo obligatorio de cobertura.** Cada partido se calcula utilizando exclusivamente sus posiciones documentadas, sin ocultar o invalidar resultados por baja cobertura.

**Propuesta:** 20% como umbral de **advertencia informativa** (no obligatorio).

**Justificación:**
- Por debajo de 20%, el porcentaje de coincidencia es poco informativo.
- Se muestra advertencia visible: "Cobertura limitada: solo X de Y preguntas tienen posición verificada".
- **El porcentaje NO se oculta ni se invalida.** La advertencia es puramente informativa.
- Se ajusta tras pruebas de usabilidad.
- **Nunca se ocultará un resultado por quedar por debajo del umbral.**

---

## 3. Decisiones no bloqueantes

### D-07: Nombre y dominio comercial

**Estado:** Pendiente. No bloquea arquitectura.

**Identificador técnico provisional:** `affinity-platform`.

**Recomendación:** Decidir antes del lanzamiento público (H6). No afecta desarrollo.

---

### D-08: Número exacto de preguntas por modalidad

**Estado:** Pendiente. Los números 15/40/100 son ilustrativos.

**Recomendación:** Definir tras medir cobertura y tiempos de respuesta con datos reales. El admin define pools configurables.

---

### D-09: Exportación PDF

**Estado:** Pendiente. JSON es suficiente para MVP.

**Recomendación:** Posponer a post-MVP. La exportación JSON cumple el requisito mínimo. El PDF se puede generar desde el navegador con `window.print()` si es necesario.

---

### D-10: Política de backups

**Estado:** Pendiente. Necesaria para H6.

**Propuesta:**
- Frecuencia: semanal (domingo a las 3:00).
- Contenido: `pg_dump` de PostgreSQL + copia de `storage/`.
- Almacenamiento: disco local del VPS + disco externo opcional.
- Retención: 4 copias (4 semanas).
- Restauración probada al menos una vez antes de producción.

---

### D-11: Estadísticas globales futuras

**Estado:** No implementadas en MVP. Sin puerta trasera.

**Recomendación:** No instrumentar recolección hasta diseño específico aprobado. Cualquier estadística futura requerirá:
- Diseño de anonimización.
- Evaluación de protección de datos.
- Participación voluntaria del usuario.
- Técnica de agregación que no permita reconstruir respuestas individuales.

---

## 4. Resumen de decisiones

| ID | Decisión | Estado | Bloquea | Prioridad | Recomendación |
|---|---|---|---|---|---|
| D-01 | Autenticación admin | ✅ Confirmada | — | Crítica | OTP por email con Brevo |
| D-02 | Fórmula multidimensional y calibración | ✅ Confirmada | — | Alta | Media ponderada, 3 modos de calibración |
| D-03 | Esquema de exportación | ⏳ Pendiente | H3-4 | Media | JSON versionado con hash |
| D-04 | Configuración de LLM | ✅ Confirmada | — | Media | Anthropic (Claude) con fallback OpenAI |
| D-05 | Comunicación con worker | ⏳ Pendiente | H1-3 | Media | Proceso hijo (execa) |
| D-06 | Umbral de advertencia de cobertura | ⏳ Pendiente | H4-2 | Media | 20% como advertencia informativa |
| D-07 | Nombre y dominio | ⏳ Pendiente | H6 | Baja | Decidir antes de lanzamiento |
| D-08 | Preguntas por modalidad | ⏳ Pendiente | H3 | Baja | Definir tras pruebas |
| D-09 | Exportación PDF | ⏳ Pendiente | — | Baja | Posponer a post-MVP |
| D-10 | Política de backups | ⏳ Pendiente | H6 | Media | Semanal, 4 copias |
| D-11 | Estadísticas futuras | ⏳ Pendiente | — | Baja | No instrumentar en MVP |

---

## 5. Decisiones editoriales del banco piloto

### Q021: sistema electoral

**Estado:** ✅ **Resuelta: excluir del cuestionario del release.**

**Decisión (2026-11-20):** Q021 no se incluirá en el cuestionario del release porque los programas revisados no contienen posiciones sustantivas comparables sobre una reforma del sistema electoral. Mantenerla produciría una pregunta que no puntúa para ninguno de los partidos; reformularla requeriría definir otro tema y volver a buscar y revisar evidencia.

**Alcance:** No se elimina ni modifica la pregunta o sus cinco posiciones rechazadas en la base de datos. Se conserva el registro editorial de que los programas no tratan el tema. Para el release, se seleccionarán preguntas con al menos una posición aprobada, por lo que Q021 quedará fuera. El aviso del candidato de release sobre Q021 sin posiciones aprobadas es esperado y no requiere acción.
