# Propuesta: interfaz de evaluación humana ciega para 29N (SUSTITUIDA por `propuesta-area-online-evaluacion.md`)

> **Sustituida el 2026-11-25.** El responsable descartó los paquetes HTML autónomos y la importación manual y pidió un área online permanente con acceso por correo y OTP. Se conserva como registro de la alternativa evaluada.

Fecha: 2026-11-25. Objetivo: sustituir las hojas Markdown por un procedimiento reutilizable de evaluación humana ciega que alimente `position_codings` (solo añadir), mida la concordancia humano–humano, humano–IA e IA–IA y permita adjudicar sin contaminar la evaluación ciega. El piloto de 19 celdas es una **muestra dirigida** (casos conflictivos e informativos): sus métricas **no se extrapolan** al banco ni sustituyen la campaña de ~150 celdas.

## 1. Qué existe y se puede reutilizar
| Componente | Estado actual | Reutilización |
|---|---|---|
| Panel administrativo Nuxt (`app/pages/admin`, `layouts/admin.vue`, `assets/css/admin.css`) | Funciona solo contra la BD local; **se excluye del build público** (`DEPLOY_TARGET=public`) | Alojar las pantallas; mismo estilo; sin exponer nada en Vercel |
| `/admin/jev-labeling` | Pantalla de etiquetado ciego: progreso, navegación, atajos de teclado, borrador/guardado. **Guarda en un JSON** (`benchmark_sample.json`), con anotador en texto libre, clases antiguas y sin cierre ni campañas | Patrones de interfaz (no el almacenamiento) |
| Autenticación | Un único administrador por correo con OTP (`admin_credentials`, `admin_sessions`); `requireAdmin` **no identifica a la persona** y no hay roles | Válida para ti. **Insuficiente para evaluadores externos** (darles acceso daría control total del panel) |
| `position_codings` (migración 009) | Solo añadir; clase, intensidad, estado técnico, evidencia, justificación, `evaluator_kind = human`, `blind`, `independent_of`, versiones de ítem y manual | Destino de las evaluaciones **finalizadas** |
| `agreement.mjs`, `benchmark_analyze.mjs`, verificación externa | Krippendorff nominal/ordinal, kappa ponderado, Gwet AC1/AC2, IC por bootstrap | Reutilizar como servicio de métricas (humano–humano, humano–IA, IA–IA) |
| Paquete de pasajes (`benchmark_pack_B_S.json`) y manual `coding-manual-v0.md` | Pasajes con página, manual versionado | Contenido de cada celda y manual mostrado |
| `editorial_audit` | Registro de acciones administrativas | Registro de auditoría de campañas y adjudicaciones |

Lo que **falta** (no existe y habría que crear): campañas, asignación de celdas a evaluadores, identidad y tipo de evaluador (interno/externo), borradores mutables, cierre irreversible de la evaluación ciega, indicador de «contexto insuficiente», selección de las evidencias que justifican la decisión, tabla de adjudicaciones y la separación entre ceguera y adjudicación.

## 2. Cobertura de los requisitos
| Requisito | Cómo se cubre |
|---|---|
| Campañas, asignación de celdas | Tablas nuevas (`evaluation_campaigns`, `campaign_cells`, `campaign_evaluators`) |
| Pregunta, contexto, manual, evidencias con página | Instantánea congelada de la celda (misma estructura que el paquete de B) y manual versionado |
| Partido oculto; sin puntuaciones ni respuestas de otros | La instantánea de la celda **no contiene** esos datos; el partido se sustituye por una etiqueta («Partido A») |
| Cinco clases + intensidad ordinal | Mismas restricciones que `position_codings` |
| Seleccionar evidencias que justifican; justificación | Campos de la evaluación (índices de pasaje + texto) |
| «Contexto insuficiente» | Marca propia; no es una clase documental ni un fallo técnico |
| Guardar progreso; finalizar y bloquear | `evaluation_drafts` (mutables) → al finalizar se copia a `position_codings` (solo añadir) y se cierra |
| Separar ceguera y adjudicación | La hoja de adjudicación solo se genera cuando **todos** los evaluadores de la celda han finalizado; adjudicaciones en tabla propia, también solo añadir |
| Distinguir mis evaluaciones internas de las externas | `evaluator_kind = human` + campo `affiliation = internal | external` |
| Métricas humano–humano, humano–IA, IA–IA con alfa nominal/ordinal, kappa, AC1/AC2 | Servicio de métricas sobre `position_codings`, separado por tipo |
| Documentar el sesgo de selección | La campaña guarda su método de selección y lo imprime en cada informe |
| Exportar resultados e informes | CSV/JSON y el informe local (`build_full_report.mjs`) |

## 3. Opciones
**A. Ampliar el panel administrativo y dar acceso a los evaluadores.** Habría que añadir roles y exponer el servidor local a Internet (túnel o VPN) para los externos. Mayor superficie de ataque y trabajo operativo; cada evaluador pasaría por OTP.

**B. Paquete HTML autónomo por evaluador (sin servidor ni cuentas).** Un script genera, a partir de la campaña, **un único fichero HTML** con las celdas de ese evaluador (sin salidas de modelos ni referencia). El evaluador lo abre en su navegador, guarda su progreso en el propio navegador, y al **finalizar** descarga un JSON con sus evaluaciones y una huella SHA-256. Se importa con un script que valida y escribe en `position_codings`. Ceguera por construcción, ningún despliegue, funciona para externos.

**C. Híbrida (recomendada).** B para evaluadores (internos y externos) y panel administrativo local solo para ti: crear campañas, generar paquetes, importar, adjudicar y ver métricas, reutilizando los patrones de `jev-labeling`.

| Criterio | A | B | C |
|---|---|---|---|
| Exposición a Internet / cuentas nuevas | Alta | Ninguna | Ninguna |
| Ceguera garantizada | Por permisos | Por construcción | Por construcción |
| Cierre irreversible aplicado por el servidor | Sí | Por exportación (huella; el importador rechaza duplicados) | Igual que B |
| Adecuación a evaluadores externos | Media | Alta | Alta |
| Esfuerzo | Alto | Bajo-medio | Medio (por fases) |

## 4. Plan por fases (si se aprueba C)
1. **Fase 1 (piloto):** migración 010 (campañas, celdas, evaluadores, adjudicaciones, marca «contexto insuficiente» y «afiliación»); generador de paquete HTML; importador con validación; tests (ceguera: el paquete no contiene referencia ni salidas de modelos; huella; rechazo de duplicados; restricciones de clase/intensidad). Con eso se ejecuta el piloto de 19 celdas.
2. **Fase 2:** páginas de administración (campañas, asignación, importación, estado) y servicio de métricas separadas por tipo.
3. **Fase 3:** pantalla de adjudicación (solo tras el cierre de todos los evaluadores de la celda), exportación e informe, y la campaña de ~150 celdas.

## 5. Seguridad y privacidad
Sin cuentas públicas. Los paquetes solo contienen la celda (pregunta, contexto, pasajes) y el manual; no incluyen claves, la referencia provisional ni respuestas de modelos. La identidad del evaluador es una etiqueta de la campaña, no un dato personal obligatorio. Las evaluaciones nunca se sobrescriben. Los resultados se guardan en local.

## 6. Riesgos y límites
- Con 19 celdas y 2–3 evaluadores humanos el IC del alfa será ancho: sirve para detectar problemas del manual y del procedimiento, no para acreditar fiabilidad.
- El partido se oculta como etiqueta, pero el texto de los pasajes puede delatarlo; se documenta.
- En la opción B el cierre depende de que el evaluador exporte; el importador comprueba la huella y que no haya evaluaciones previas de esa celda y evaluador.
- Todo lo anterior deja intactos producción, banco de preguntas, scoring, posiciones adjudicadas y el release 2.1.2.

## 7. Qué no se hace hasta que se apruebe
No se implementa nada. Los benchmarks A y B permanecen cerrados (D19) y el conjunto E sellado.
