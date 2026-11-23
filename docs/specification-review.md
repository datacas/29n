# Auditoría de la especificación v1.1

**Fecha:** 2026-11-13  
**Especificación revisada:** `especificacion_plataforma_afinidad_v1_1.md`  
**Versión anterior comparada:** `especificacion_plataforma_afinidad_v1.md` (v1.0)

---

## 1. Resumen de hallazgos

| Categoría | Cantidad | Severidad |
|---|---|---|
| Contradicciones resueltas (v1.0 → v1.1) | 6 | Cerradas |
| Contradicciones pendientes | 3 | Media |
| Ambigüedades | 5 | Media-Baja |
| Requisitos incompletos | 4 | Media |
| Complejidad innecesaria detectada | 2 | Baja |
| Riesgos técnicos | 5 | Alta-Media |
| Riesgos de privacidad | 2 | Alta |
| Funcionalidades recomendadas para posponer | 3 | Baja |

---

## 2. Contradicciones entre v1.0 y v1.1 (resueltas)

### C-01: Guardado remoto de encuestas
- **v1.0:** Guardado remoto optativo mediante email + OTP (sección 4.2, 11.2).
- **v1.1:** Revocado completamente. Solo IndexedDB local (decisión 10, sección 2).
- **Estado:** ✅ Resuelta. La v1.1 es clara.

### C-02: Almacenamiento de documentos
- **v1.0:** S3 compatible (sección 13, tabla de arquitectura).
- **v1.1:** Disco local del VPS (sección 14, tabla de arquitectura).
- **Estado:** ✅ Resuelta. La v1.1 es clara.

### C-03: Cuentas de usuario
- **v1.0:** Tabla `accounts`, `saved_surveys`, `otp_challenges`, `consent_records` (sección 5.1).
- **v1.1:** No crear estas tablas (sección 7 explícito).
- **Estado:** ✅ Resuelta. La v1.1 es clara.

### C-04: Proveedor de email
- **v1.0:** Brevo gratuito para OTP (sección 11.1).
- **v1.1:** Brevo fuera del MVP para usuarios; pendiente para admin (decisión 9).
- **Estado:** ✅ Resuelta parcialmente. Pendiente decisión admin.

### C-05: Estadísticas globales
- **v1.0:** Diseñadas pero no implementadas en MVP (sección 2.2).
- **v1.1:** Explícitamente excluidas, sin puerta trasera (sección 13).
- **Estado:** ✅ Resuelta. La v1.1 es más estricta.

### C-06: Panel admin en la app Nuxt
- **v1.0:** Apps separadas `web/` y `api/` (sección 13.1).
- **v1.1:** Permite admin en la misma app Nuxt si simplifica (sección 14).
- **Estado:** ✅ Resuelta. La v1.1 da flexibilidad.

---

## 3. Contradicciones pendientes dentro de v1.1

### C-P01: pgvector — incluido vs. opcional
- **Requisito afectado:** Sección 14 (tabla de arquitectura) menciona pgvector "si aporta valor".
- **Naturaleza:** La especificación no define cuándo aporta valor real. Sin criterios de adopción, es una dependencia pendiente que puede complicar el MVP.
- **Alternativas:**
  1. Excluir pgvector del MVP y usar búsqueda por texto completo de PostgreSQL + taxonomía.
  2. Incluirlo desde el inicio para clasificación temática de propuestas.
- **Recomendación técnica:** Opción 1. El MVP puede funcionar con taxonomía jerárquica y búsqueda por texto. pgvector se añade cuando se demuestre necesidad real con datos.
- **Impacto:** Simplifica el stack inicial, reduce dependencias y complejidad de despliegue.

### C-P02: Worker documental — proceso local vs. servicio separado
- **Requisito afectado:** Sección 14 menciona "Worker Python local ejecutado bajo trabajos controlados; sin sistema distribuido inicial".
- **Naturaleza:** No se especifica cómo se comunican Nuxt y el worker. ¿Proceso hijo? ¿Script ejecutado vía API? ¿Cola en BD?
- **Alternativas:**
  1. Script Python ejecutado desde la API Nuxt como proceso hijo (más simple).
  2. Servicio Python independiente con cola de trabajos en PostgreSQL (más robusto).
- **Recomendación técnica:** Opción 1 para MVP. Un endpoint admin invoca el script Python con `child_process` o `execa`. La cola de trabajos se gestiona en la BD con estados.
- **Impacto:** Reduce complejidad operativa. Se migra a servicio separado si la carga lo requiere.

### C-P03: Fórmula de scoring — unidimensional vs. multidimensional
- **Requisito afectado:** Sección 11 presenta fórmula unidimensional pero dice "modelo multidimensional" y "la regla exacta de agregación por dimensión sigue pendiente".
- **Naturaleza:** La fórmula candidata es unidimensional. La versión multidimensional no está especificada.
- **Alternativas:**
  1. Implementar primero la fórmula unidimensional y añadir dimensiones después.
  2. Diseñar la fórmula multidimensional completa antes de implementar.
- **Recomendación técnica:** Opción 2. La fórmula multidimensional es una decisión de producto que afecta la UI, el modelo de datos y la interpretación de resultados. Definirla antes evita rework.
- **Impacto:** Bloquea la implementación del motor de scoring hasta cerrar la fórmula.

---

## 4. Ambigüedades

### A-01: "Selección determinista" de preguntas
- **Sección:** 10, punto 6.
- **Ambigüedad:** No se especifica el algoritmo de selección. ¿Aleatorio con semilla? ¿Fijo por modalidad? ¿Rotación?
- **Recomendación:** Para MVP, usar conjuntos fijos por modalidad (rápida/normal/profunda) definidos por el admin. La adaptación determinista es fase posterior.

### A-02: "Modalidades de profundidad"
- **Sección:** 10, punto 6.
- **Ambigüedad:** Los números 15/40/100 son "ilustrativos" pero no se define cómo se seleccionan las preguntas de cada modalidad. ¿Subconjunto? ¿Aleatorio del banco?
- **Recomendación:** El admin define pools de preguntas por modalidad. Cada pool es un subconjunto del banco total.

### A-03: "Exportación e importación de resultados"
- **Sección:** 5, punto 5.
- **Ambigüedad:** No se especifica el esquema JSON de exportación. ¿Incluye respuestas, pesos, release_id, scoring_model? ¿Validación de importación?
- **Recomendación:** Definir un esquema JSON versionado con: `version`, `survey_release_id`, `scoring_model_version`, `answers[]`, `weights[]`, `entities[]`, `timestamp`, `hash`. Validar esquema y release_id al importar.

### A-04: "Aprobación por lotes"
- **Sección:** 6, punto 10.
- **Ambigüedad:** No se define qué constituye un "lote". ¿Por documento? ¿Por entidad? ¿Por tema? ¿Tamaño máximo?
- **Recomendación:** Un lote es un conjunto de propuestas de un mismo documento que pasan todas las validaciones automáticas. El admin aprueba el lote completo o lo rompe para revisión individual.

### A-05: "Recalculo de resultados"
- **Sección:** 11, sección de pruebas.
- **Ambigüedad:** No se especifica cuándo se recalcula. ¿Al actualizar un programa? ¿Al cambiar la fórmula? ¿Manual?
- **Recomendación:** Los resultados se calculan siempre en el navegador con el release activo. Si el admin publica un nuevo release, los resultados antiguos se conservan con el release original. El recalculo es una acción explícita del usuario.

---

## 5. Requisitos incompletos

### R-01: Esquema de exportación/importación
- **Descripción:** Se menciona exportación JSON pero no se define el esquema, versión, validación o límites de tamaño.
- **Recomendación:** Definir esquema JSON Schema con versión semántica. Límite de 10 MB para importación. Validación de integridad con hash interno.

### R-02: Política de retención de documentos
- **Descripción:** Se menciona "pocos documentos en disco" pero no hay política de retención, limpieza o archivado.
- **Recomendación:** Definir política simple: documentos aceptados se conservan indefinidamente; documentos rechazados se archivan tras 30 días; backups básicos semanales.

### R-03: Manejo de errores del worker
- **Descripción:** Se menciona el worker documental pero no se especifica el manejo de errores: PDF corrupto, OCR fallido, LLM no disponible.
- **Recomendación:** Definir estados de error en `document_jobs`: `failed_pdf`, `failed_ocr`, `failed_llm`, `timeout`. Permitir reintentos manuales desde admin.

### R-04: Recuperación de acceso admin
- **Descripción:** Se menciona la necesidad de definir recuperación pero no se propone un mecanismo concreto.
- **Recomendación:** Incluir en la decisión de autenticación: passkey secundaria + códigos de emergencia offline (8 códigos, uno por recuperación).

---

## 6. Complejidad innecesaria detectada

### X-01: `universes` en el MVP
- **Descripción:** La tabla `universes` permite política, historia, ficción, etc.
- **Recomendación:** Para MVP, usar un campo `category` en `consultations` en lugar de una tabla separada. La tabla `universes` se crea cuando se añaden cuestionarios de entretenimiento.

### X-02: `entity_versions` en el MVP
- **Descripción:** Versionado temporal de entidades con marco histórico.
- **Recomendación:** Para MVP, cada entidad tiene un `period_label` (p. ej. "2026", "1920") y `is_historical`. El versionado completo se añade cuando se necesite tracking de cambios de nombre/coalición.

---

## 7. Riesgos técnicos y metodológicos

### T-01: Calidad de extracción de PDFs
- **Riesgo:** PDFs escaneados, tablas complejas o estructura no lineal pueden generar extracciones de baja calidad.
- **Mitigación:** OCR solo cuando sea necesario. Validación de citas por el verificador independiente. Revisión humana obligatoria.

### T-02: Dependencia de LLM externo
- **Riesgo:** Costes, disponibilidad, latencia y cambios de API del proveedor.
- **Mitigación:** Adaptadores intercambiables. Fallback a reglas y taxonomía. Benchmark con corpus real antes de decidir.

### T-03: Sesgo en selección de preguntas
- **Riesgo:** Un pool de preguntas puede favorecer a ciertas entidades por cobertura desigual.
- **Mitigación:** Matriz de cobertura visible. Análisis de sensibilidad. Revisión editorial de pools.

### T-04: Comparabilidad histórica
- **Riesgo:** Preguntas contemporáneas no son comparables con documentos históricos sin adaptación semántica.
- **Mitigación:** Estado `not_comparable` explícito. Revisión humana de equivalencias. Contexto histórico visible.

### T-05: Escalabilidad del scoring en navegador
- **Riesgo:** Cálculo con muchas entidades y preguntas puede ser lento en dispositivos de gama baja.
- **Mitigación:** Motor TS optimizado. Tests de rendimiento con 100 preguntas × 20 entidades. Lazy rendering de resultados.

---

## 8. Riesgos de privacidad y seguridad

### P-01: Logs del servidor
- **Riesgo:** Los logs HTTP pueden contener IPs y user-agents, que son datos personales bajo RGPD.
- **Mitigación:** Minimizar logs. No registrar rutas de encuesta ni parámetros. Anonimizar IPs en logs. Política de retención de 30 días.

### P-02: Acceso admin comprometido
- **Riesgo:** Un único administrador con acceso total. Sin recuperación definida.
- **Mitigación:** Definir mecanismo de autenticación robusto (passkey o OTP). Códigos de emergencia. Auditoría de todas las acciones. Rate limiting en endpoints admin.

---

## 9. Funcionalidades recomendadas para posponer

### S-01: Exportación PDF bonita
- **Razón:** JSON es suficiente para MVP. PDF requiere librería adicional y diseño.
- **Fase:** Post-MVP.

### S-02: Previsualización de cuestionario en admin
- **Razón:** El admin puede probar el cuestionario como visitante.
- **Fase:** Post-MVP o si el feedback lo justifica.

### S-03: Simulador de resultados con datos ficticios
- **Razón:** Útil pero no esencial para MVP. El admin puede calcular manualmente.
- **Fase:** Post-MVP.

---

## 10. Conclusiones

La especificación v1.1 es **coherente y bien estructurada**. Las decisiones 1-13 resuelven la mayoría de las contradicciones de la v1.0. Los puntos pendientes principales son:

1. **Mecanismo de autenticación admin** — bloqueante para desarrollo del panel.
2. **Fórmula multidimensional** — bloqueante para motor de scoring.
3. **Esquema de exportación/importación** — necesario para funcionalidad local.
4. **Comunicación con worker documental** — necesario para pipeline de IA.

El resto de ambigüedades son de nivel medio-bajo y pueden resolverse durante la implementación con las recomendaciones proporcionadas.
