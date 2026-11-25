# Proceso completo de la revisión metodológica de 29N

Documento maestro. Cubre desde la recepción del feedback hasta la preparación y arranque de la modalidad B. Todo el trabajo se realizó el **2026-11-25** (hora peninsular) sobre el release **2.1.2**, que permanece congelado hasta el 29-nov-2026.

> **Alcance de este documento.** Describe el proceso, las decisiones, el código, las configuraciones y las desviaciones. Los resultados detallados (por ítem, por partido, por modelo y por celda) se guardan en `docs/methodology/local/`, que no se versiona. Las cifras agregadas que aparecen aquí son las necesarias para entender las decisiones de método.

## 0. Estado en este momento
| Componente | Estado |
|---|---|
| Auditoría inicial de ítems | Hecha (en sombra, un solo evaluador; sin validar por humanos) |
| Análisis de sensibilidad, asimetría y cobertura | Hechos con usuarios sintéticos y datos exportados |
| Clases documentales + estados de ejecución | Aprobadas e implementadas en BD local (migración 009) |
| Métricas de concordancia (Krippendorff nominal/ordinal, kappa ponderado, Gwet AC1/AC2) | Implementadas y verificadas contra librerías externas |
| Modalidad A (S, 28 celdas) | Ejecutada con 10 evaluadores (Gemini 3.6 flash pendiente) |
| Spike de recuperación (BM25, embeddings, híbrido, reordenador, traducción) | Terminado |
| Configuración de recuperación de B | **Congelada** (huella `acd59e44…`) |
| Modalidad B, etapa 1 | **En ejecución** con Llama 4 Scout y Codex; DeepSeek y Gemini 4 Hydrogen bloqueados por cuota (D18) |
| Modalidad B, etapa 2 | **En ejecución** sobre las 40 celdas (D18) |
| Conjunto E | **Sellado**: no se ha accedido |
| Recodificación masiva, validación humana, nuevo release | No iniciados |

## 1. Origen y restricciones permanentes
**Feedback recibido** (resumido):
1. Revisión lógica de los ítems para que nadie quede sin respuesta posible.
2. Medir validez y fiabilidad de la codificación de programas (alfa de Krippendorff, kappa de Cohen), porque distintos evaluadores pueden puntuar distinto la misma evidencia.
3. Preguntas de doble contenido (caso real: financiación pública de sindicatos y organizaciones empresariales).

**Restricciones vigentes durante todo el proceso**
- No tocar producción, banco de preguntas, scoring, posiciones adjudicadas ni el release 2.1.2.
- Scoring público determinista, sin IA en tiempo real.
- No imputar posiciones por silencio documental; neutralidad ≠ ausencia de evidencia.
- Neutralidad entre partidos; mismos criterios para todos.
- Máxima automatización razonable; humanos donde aportan valor metodológico.
- No afirmar validez científica sin evidencia suficiente.
- Conjunto E sellado; nada de coste no autorizado; resultados detallados no públicos.

## 2. Registro de decisiones
| # | Fecha | Decisión | Quién |
|---|---|---|---|
| D1 | 2026-11-25 | Congelar el release 2.1.2 hasta el 29-nov; solo trabajo en sombra | Responsable |
| D2 | 2026-11-25 | Segundos codificadores: Codex y Jev, más modelos de OmniRoute; Claude es el primer codificador | Responsable |
| D3 | 2026-11-25 | Tabla nueva append-only `position_codings`; `positions` queda como resultado adjudicado | Responsable |
| D4 | 2026-11-25 | Al dividir preguntas, las hijas conservan `theme_code`; no se toca el algoritmo; se mide antes | Responsable |
| D5 | 2026-11-25 | Validación humana: 2 evaluadores, ~150 celdas, después del 29-nov | Responsable |
| D6 | 2026-11-25 | Bloquean la publicación: discrepancia de signo sin adjudicar, ítem sin atomicidad o sin dirección, cita no verificable. Las métricas avisan, no bloquean | Responsable |
| D7 | 2026-11-25 | Silencio: no imputar oposición; cuantificar con la 2ª codificación (4 clases iniciales) | Responsable |
| D8 | 2026-11-25 | Autorizados los 14 issues (#45–#58) y la fase 0 en sombra, con 15 precisiones | Responsable |
| D9 | 2026-11-25 | Cinco clases documentales (`supports`, `opposes`, `explicit_neutral`, `not_mentioned`, `ambiguous`), separadas de la intensidad y de los estados técnicos de ejecución | Responsable |
| D10 | 2026-11-25 | Migración 009 solo en BD local con backup; OmniRoute en solo lectura para el catálogo | Responsable |
| D11 | 2026-11-25 | Estrategia Git: rama de integración `methodology-integration`, ramas `methodology-*`, Vercel desactivado para ese patrón, sin merge a `main` sin autorización expresa | Responsable |
| D12 | 2026-11-25 | Panel de 7 modelos y arnés robusto para la modalidad A; criterios congelados antes de resultados | Responsable |
| D13 | 2026-11-25 | Recuperador V7 con K=15 para el benchmark inicial; embeddings y reordenador como spike **en paralelo** | Responsable |
| D14 | 2026-11-25 | Reanudar A con corrección técnica de `max_tokens`; usar Codex, DeepSeek (OpenCode) y Gemini 4 Hydrogen (`agy`) como evaluadores adicionales | Responsable |
| D15 | 2026-11-25 | Detener Gemma 4 31B (lenta) | Responsable |
| D16 | 2026-11-25 | Recuperador de B: BM25 V7 + BGE-M3 (RRF, 25 candidatos) + bge-reranker-v2-m3, K=10; E5-large descartado | Responsable |
| D17 | 2026-11-25 | Autorizadas las etapas 1 y 2 de la modalidad B (conjunto S) con 16 precisiones | Responsable |
| D18 | 2026-11-25 | No esperar al reinicio de cuota de DeepSeek (~11,8 h): «jugar con lo que tenemos». DeepSeek y Gemini 4 Hydrogen (`agy`, reinicio en ~166 h) quedan como **limitación operativa** en B; el panel adicional (Ministral, MiniMax, Qwen, GPT-OSS) se ejecuta sobre las 40 celdas en lugar de solo sobre las seleccionadas | Responsable |

## 3. Cronología detallada

### 3.1 Fase 0 — análisis y auditoría en sombra
**Qué se auditó** (release 2.1.2: 146 preguntas, 19 partidos, 1.048 posiciones registradas):
- **Ítems** (`item_audit.mjs` + juicios locales): marcas léxicas deterministas (conjunciones, verbos sin dirección, absolutos, statu quo, cláusulas de finalidad, términos cargados) combinadas con juicios adversariales (contraejemplos) de un único evaluador (Claude). Los resultados son **candidatos a revisión, no resultados validados**. La marca léxica por sí sola prioriza pero no decide: se informa su precisión y exhaustividad frente al juicio adversarial.
- **Asimetría** (`asymmetry.mjs`): reparto de signos por partido, dimensión y tema. Conclusión metodológica: el silencio de un programa se registra como «sin posición» (no como oposición), lo que es un problema de **validez** además de fiabilidad. No se atribuyen causas todavía.
- **Cobertura y denominadores** (`coverage.mjs`): 2.774 celdas pregunta × partido; 1.726 sin fila; 1.048 filas exportadas = 1.041 utilizables + 7 no utilizables (ambiguous o no comparables). Reconciliación documentada: son universos distintos (filas exportadas frente a utilizables).
- **Sensibilidad** (`sensitivity.mjs`): simulación determinista (semilla 29) con usuarios sintéticos de seis arquetipos y seis perturbaciones de la codificación; reutiliza la fórmula de `app/lib/scoring/calculate.ts` sin modificarla. Es **hipotética**: no es incertidumbre observada.

**Issues creados**: 14 issues agrupados (#45–#58) y uno de seguimiento (#59) con la matriz de trazabilidad (ver `trazabilidad.md`).

### 3.2 Fase 1 — infraestructura
1. **Clases documentales y estados de ejecución** (`clases-documentales.md`): un fallo de API, un *timeout*, un documento inaccesible o una búsqueda fallida **nunca** es `not_mentioned`; la restricción está en la BD (`db/migrations/009_position_codings.sql`).
2. **Migración 009**: tabla `position_codings` de solo añadir (disparadores que rechazan UPDATE, DELETE y TRUNCATE). Aplicada solo en BD local (`affinity` y `affinity_test`) tras backup. Probada en una BD temporal (12/12 pruebas, idempotente). Recuperación documentada en `fase1/migracion-009.md`.
3. **OmniRoute** (pasarela de modelos local, v3.8.54, `127.0.0.1:20128`): inventario de catálogo en solo lectura; sondeo en tres pasadas. Hallazgos operativos relevantes en §4.
4. **Diseño del benchmark** (`propuesta-benchmark-reducido.md`): conjuntos S (cribado, 40 celdas), D (ajuste, 59) y E (evaluación final, 146, **sellado** con huella `d363dc51ae8c…`) disjuntos **por pregunta**. Modalidad A (evidencia de referencia + distractores) y B (recuperación automática).
5. **Manual de codificación** `0.1-benchmark` (`coding-manual-v0.md`): cinco clases, intensidad, regla de no imputar por silencio, evidencia literal con página, salida JSON.
6. **Recuperación de pasajes**: diagnóstico determinista sobre 457 celdas de desarrollo (cita registrada como referencia; E excluido). Probadas 10 variantes (BM25 base, lematización, contexto, pseudo-relevancia, ventanas, consulta dual, expansión por ítem, expansión en idioma original…). Mejor léxica: BM25 con lematización, consulta ampliada con vocabulario por ítem (V7).
7. **Métricas de concordancia** (`agreement.mjs`, `tests/methodology/agreement.test.ts`, `fase1/verificacion-externa.md`): Krippendorff nominal/ordinal/intervalo con IC por bootstrap, kappa ponderado, Gwet AC1/AC2. Verificadas contra `krippendorff`, `scikit-learn` e `irrCAC` (diferencias ≤ 5·10⁻¹⁶ en alfa y kappa, ≤ 7·10⁻⁶ en Gwet).
8. **Modalidad A**: ejecutor (`benchmark_run.mjs` y `benchmark_run_cli.mjs`), análisis (`benchmark_analyze.mjs`) y criterios congelados (`criterios-aceptacion-modalidad-A.md`, commit `03e0cd9`).
9. **Spike de embeddings y reordenación** (`spike_*.py`, `spike_stats.py`): BM25 V7 frente a BGE-M3, E5-large, híbrido por RRF y reordenador `bge-reranker-v2-m3`, con estadística pareada. Traducción auxiliar al castellano de ERC, Compromís y BNG (NLLB-200) como índice alternativo. Análisis de las celdas sin posición para priorizar una futura auditoría de silencio.
10. **Preparación de B**: configuración congelada (`retriever-config-B.json`), paquete híbrido para S (`pack_b_export.mjs`, `pack_b_build.py`), selección pre-registrada para el panel adicional (`benchmark_stage2.mjs`).

## 4. Registro de desviaciones, incidencias y errores corregidos
Se documentan **todas**, incluidos errores míos. Ninguna modifica los criterios congelados.

| # | Qué pasó | Impacto | Corrección |
|---|---|---|---|
| I1 | OmniRoute (memoria y *skills* activados) **inyectaba 4 herramientas `memory_*`** en todas las peticiones; Qwen llamaba a `memory_search` | El primer piloto se hizo con una configuración distinta; riesgo de contaminación de la evaluación ciega | Cabecera `x-omniroute-no-memory: 1` (la otra variante probada no funcionaba). Primer piloto archivado; piloto limpio con 0 herramientas inyectadas (verificado en el registro de OmniRoute) |
| I2 | La caché de OmniRoute podía devolver respuestas repetidas | No se observaron aciertos (`x-omniroute-cache: MISS` siempre) | Se registran las cabeceras `x-omniroute-*`; un acierto de caché se trataría como anomalía reintentable |
| I3 | **Fallback silencioso**: ante un 429 OmniRoute cambiaba de modelo (Nemotron) | Respuestas atribuibles a otro modelo | Se detecta comparando el modelo pedido con el real; esas respuestas se excluyen de las métricas individuales, se reintentan y se informan aparte |
| I4 | El paquete buscaba la cita de referencia dentro del ranking del recuperador | Una celda de BNG (gallego) quedó sin referencia verificable por error mío; la cita sí estaba en el PDF, exacta y en su página | La referencia se localiza **por la cita**, nunca por el ranking |
| I5 | `max_tokens` insuficiente en modelos de razonamiento (Gemma, MiniMax, Qwen, GPT-OSS, Gemini 3.6 flash) | Salidas truncadas (`finish_reason = length`) clasificadas como inválidas | Límites subidos; se guarda `max_tokens` en cada registro; los intentos con una configuración anterior no cuentan y se informan aparte (Gemini: 27 intentos) |
| I6 | El interruptor de fallos paraba **todo el proveedor** | Gemini 3.6 flash en enfriamiento impedía evaluar a Gemma | El interruptor es por modelo |
| I7 | El análisis declaraba «no pasa» con n muy pequeño (p. ej. 2 respuestas) | Clasificaciones engañosas | Nueva categoría «no evaluable» por tamaño mínimo (20 respuestas propias y 10 pares); **no cambia ningún umbral** y se documenta como aclaración posterior |
| I8 | Cuotas gratuitas agotadas (Groq por presupuesto de tokens; Gemini 3.6 flash en enfriamiento diario hasta el 26-nov 08:59) | Qwen y GPT-OSS parciales; Gemini 3.6 flash sin evaluar | Limitación operativa, no de calidad; reanudable con el mismo comando |
| I9 | Mi comando `pkill` coincidió con su propia línea de comandos y mató trabajos en marcha | Tareas reiniciadas | Se evita el patrón; se mata por PID |
| I10 | `nvidia-smi` no estaba en el PATH de WSL; instalé PyTorch solo CPU | Reordenador lento en CPU | La máquina **sí tiene GPU** (RTX 4070 Laptop 8 GB, `/usr/lib/wsl/lib/nvidia-smi`); entorno `venv-gpu` con PyTorch CUDA; los scripts usan la GPU si existe |
| I11 | Cifras de la literatura de Krippendorff recordadas de memoria **no coincidían** con mi implementación | Falsa alarma de error | Se verificó con cálculo independiente y librerías externas; los valores de los tests proceden de ese cálculo, no de la literatura |
| I12 | AC1/AC2 de Gwet: las proporciones marginales usaban solo unidades con ≥2 evaluadores | Diferencias hasta 3·10⁻² con datos ausentes | Alineado con Gwet (2014): marginales con ≥1 evaluador, acuerdo observado con ≥2 |
| I13 | La salida del recuperador en modalidad A mezclaba hallazgos con la lectura de la referencia | — | El análisis separa siempre «concordancia con una referencia provisional» de «exactitud validada» |
| I14 | **DeepSeek (OpenCode) agotó su límite gratuito** durante B (respuesta `provider.free-limit`, reinicio en ~11,8 h); el analizador lo registró como «salida vacía» | 69 registros de B mal clasificados | El ejecutor detecta eventos de error y los marca `rate_limited`; los registros heredados se reclasifican en el análisis y se tratan como no finales; parada tras 3 fallos técnicos seguidos |
| I15 | Mensajes mal enviados por mí (`cat >> fichero` sin entrada) | Una tarea quedó colgada | Detenida; sin efectos |

## 5. Registro de ejecuciones
| Ejecución | Fichero local | Estado |
|---|---|---|
| Piloto 1 de A (con herramientas de memoria inyectadas) | `archivo_piloto1_con_herramientas_de_memoria_inyectadas.jsonl` | Archivado, no se usa |
| Piloto 2 de A (limpio, 21 llamadas) | `benchmark_S_A.jsonl` | Reutilizado |
| A completa con OmniRoute (7 modelos × 28 celdas × 2) | `benchmark_S_A.jsonl` | Terminada, con paradas por cuota |
| Reanudación de A (Gemini, Gemma, Qwen, GPT-OSS) | `benchmark_S_A.jsonl` | Gemini 3.6 flash bloqueado; Gemma detenida |
| A con Codex, DeepSeek (OpenCode) y Gemini 4 Hydrogen (`agy`) | `benchmark_S_A.jsonl` | Terminada |
| Diagnóstico de recuperación (457 celdas de desarrollo) | `retrieval_diag.{json,md}` | Terminado |
| Spike de embeddings (BGE-M3, E5-large), reordenador, silencio, traducción | `spike/` | Terminado |
| Estadística pareada de recuperadores | `spike/stats_pareadas.json` | Terminada |
| B etapa 1 (panel principal) | `benchmark_S_B.jsonl` | En ejecución; DeepSeek bloqueado hasta el reinicio de su cuota |
| B etapa 2 (panel adicional) | `benchmark_S_B.jsonl` | Lanzada sobre las 40 celdas por D18 (en lugar de solo las seleccionadas) |

## 6. Panel de evaluadores
Ver `fase1/evolucion-panel-modelos.md`. Resumen: 7 modelos vía OmniRoute (Gemini 3.6 flash, Gemma 4 31B, Ministral 14B, Qwen3.8-27B, GPT-OSS 120B, MiniMax M3.1 flash, Llama 4 Scout) + Codex (`gpt-6.2-sol`, esfuerzo bajo), DeepSeek v4.1 flash (OpenCode) y Gemini 4 Hydrogen (`agy`, `low`).
- **Panel principal de B** (familias distintas): Llama 4 Scout, Codex, DeepSeek v4.1 flash, Gemini 4 Hydrogen.
- **Panel adicional de B** (verificación y discrepancias): Ministral 14B, MiniMax M3.1, Qwen3.8-27B, GPT-OSS 120B.
- **Independencia**: Codex y GPT-OSS son del mismo proveedor y no se cuentan como independientes sin justificarlo. Codex **no** es referencia dorada.
- **Identidad de los modelos de las CLI**: son agentes; el modelo ejecutado no puede verificarse. Los resultados se atribuyen al agente y su configuración. Manual y consulta van en un único mensaje de usuario (no hay mensaje de sistema).

## 6 bis. Desviación D18 sobre el panel de B
Se diseñó un panel principal de 4 familias (Llama, Codex, DeepSeek, Hydrogen) y un adicional para discrepancias. Por cuotas, DeepSeek (reinicio en ~11,8 h) y Hydrogen (~166 h) no pueden completar B, y Gemini 3.6 flash sigue en enfriamiento. El responsable decidió no esperar. Efectos: (1) las unánimes y discrepantes de la regla pre-registrada se evaluarán **a posteriori** con los evaluadores que completen las 40 celdas; (2) el panel adicional corre sobre todas las celdas, lo que **elimina el sesgo de selección** del panel adicional pero cambia el diseño pre-registrado; (3) DeepSeek y Hydrogen aportan solo los datos parciales que alcanzaron a producir (no evaluables) y pueden añadirse después. GPT-6 Luna (OpenCode, OpenAI) está disponible, pero no aporta una familia nueva frente a Codex y no se ha usado.

## 7. Criterios y reglas pre-registradas
- **A**: criterios de calidad M1–M3 (JSON válido ≥95 %, cita fiel ≥90 %, estabilidad ≥85 %) deciden el paso a B; viabilidad O1–O4 (ejecuciones, sin fallback, latencia, parada) informa. Fallbacks excluidos de las métricas individuales. Detalle y denominadores en `fase1/criterios-aceptacion-modalidad-A.md`.
- **B etapa 2**: el panel adicional se aplica a (1) celdas donde los evaluadores principales discrepan en clase o signo y (2) el 25 % de las unánimes elegido al azar (semilla 29). Sus métricas **no se comparan** directamente con las del panel principal (selección sesgada hacia casos difíciles).
- **Recuperación de B congelada**: BM25 V7 + BGE-M3 (RRF, c=60) → 25 candidatos → `bge-reranker-v2-m3` → K=10. Los ejecutores se niegan a arrancar en modalidad B si el paquete no coincide con la huella congelada.
- **Análisis de B**: se separan las celdas cuya cita registrada llegó a los 10 pasajes de las que no (el fallo de recuperación no se atribuye al codificador). Clase e intensidad se analizan por separado.

## 8. Inventario técnico
**Scripts versionados** (`scripts/methodology/`): `lib.mjs`, `asymmetry.mjs`, `coverage.mjs`, `sensitivity.mjs`, `item_audit.mjs`, `benchmark_split.mjs`, `benchmark_pack.mjs`, `benchmark_run.mjs`, `benchmark_run_cli.mjs`, `benchmark_analyze.mjs`, `benchmark_stage2.mjs`, `agreement.mjs`, `retrieval.mjs`, `retrieval_diag.mjs`, `spike_export.mjs`, `spike_dense.py`, `spike_rerank.py`, `spike_silence.py`, `spike_stats.py`, `spike_translate.py`, `spike_translation_eval.py`, `pack_b_export.mjs`, `pack_b_build.py`, `build_full_report.mjs` y `verify_external/`. Pruebas: `tests/methodology/agreement.test.ts`. Migración: `db/migrations/009_position_codings.sql`.

**Local, no versionado** (`docs/methodology/local/`): `panel.json` (modelos y presupuestos), `retriever_frozen.json` (huella), juicios de ítems, scripts de sondeo y depuración de OmniRoute, resultados (`out/`), caché de embeddings y traducciones, `venv` (CPU) y `venv-gpu` (CUDA).

**Versiones y revisiones**
| Elemento | Versión |
|---|---|
| Node / Python | v24.22.3 / 3.10.12 |
| PyTorch | 2.14.1 (CPU y `cu126`), sentence-transformers 6.3.0 |
| GPU | NVIDIA GeForce RTX 4070 Laptop, 8 GB, CUDA 13.5 (controlador) |
| BGE-M3 | `BAAI/bge-m3` rev. `5617a9f6…` |
| Reordenador | `BAAI/bge-reranker-v2-m3` rev. `953dc6f6…` |
| E5-large (descartado) | `intfloat/multilingual-e5-large` rev. `3d7cfbda…` |
| Traducción auxiliar | `facebook/nllb-200-distilled-600M` rev. `a3e77be7…` |
| OmniRoute | 3.8.54 (memoria y *skills* activados; requiere `x-omniroute-no-memory`) |
| Codex CLI / OpenCode / agy | 0.171.0 / 2.2.7 / 1.5.17 |
| Manual de codificación | 0.1-benchmark (prompt `22e03a54fc84`) |
| Release analizado | 2.1.2, sha256 `ff91b794d201…` |
| Conjunto E (sellado) | huella `d363dc51ae8c…` |

## 9. Seguridad, privacidad y gobierno de datos
- **Claves:** la clave de cliente de OmniRoute vive en un fichero con permisos 600 fuera del repositorio; los scripts la leen en memoria y la filtran de toda salida. No se han leído `.env` del proyecto. Las claves de proveedores y las claves cifradas de otros clientes de OmniRoute no se han descifrado ni reutilizado.
- **Aislamiento de las CLI:** Codex con `--ephemeral --ignore-user-config --ignore-rules -s read-only` en un directorio vacío; OpenCode y `agy` en directorios vacíos.
- **Coste:** todos los proveedores usados son de nivel gratuito o suscripción; OmniRoute devuelve el coste por respuesta (`x-omniroute-response-cost`) y los ejecutores se detienen si es distinto de cero. Codex y `agy` consumen suscripción (sin medición por llamada).
- **Datos:** resultados en carpeta local ignorada por git; BD de producción y Neon no se tocan; la migración 009 solo existe en BD local.
- **Git:** `main` intacta; rama de integración `methodology-integration`; PR #60 en borrador; `vercel.json` incluye `git.deploymentEnabled` desactivado para `methodology-*`; verificado que ningún push generó despliegue.

## 10. Qué se puede y qué no se puede concluir
- La concordancia entre modelos **no es validación científica** (sesgos y datos compartidos; algunos modelos son agentes).
- La referencia de las celdas es la codificación registrada: **provisional**. Concordar con ella no demuestra exactitud.
- Las celdas de la modalidad A son 28 (con 12 sin posición solo en B): los IC son anchos.
- El *recall* de recuperación se mide contra la cita registrada: no es la evidencia suficiente ni la única válida.
- Los embeddings solo recuperan candidatos; no indican apoyo ni oposición.
- La traducción es un índice auxiliar; las citas definitivas proceden del original.
- Los umbrales de similitud priorizan auditorías de silencio; **no** demuestran ausencia de evidencia.
- No se presenta 29N como científicamente validado.

## 11. Cómo reproducir y reanudar
Requisitos: Node ≥ 24, Python 3.10, GPU opcional (los scripts usan CPU si no hay CUDA), OmniRoute en marcha y una clave de cliente en un fichero 600.
```
# Análisis en sombra (solo lectura del release exportado)
node scripts/methodology/asymmetry.mjs && node scripts/methodology/coverage.mjs && node scripts/methodology/sensitivity.mjs
node scripts/methodology/benchmark_split.mjs && node scripts/methodology/benchmark_pack.mjs
# Modalidad A (resultados en docs/methodology/local/out/benchmark_S_A.jsonl; reanudable repitiendo el mismo comando)
OMNIROUTE_BENCH_KEY_FILE=<fichero 600> node scripts/methodology/benchmark_run.mjs --set S --modality A --repeats 2 --confirm-authorized
node scripts/methodology/benchmark_run_cli.mjs --set S --modality A --repeats 2 --confirm-authorized
node scripts/methodology/benchmark_analyze.mjs --file docs/methodology/local/out/benchmark_S_A.jsonl
# Recuperación de B (configuración congelada; entorno con GPU)
node scripts/methodology/pack_b_export.mjs S && python scripts/methodology/pack_b_build.py S
# Modalidad B
node scripts/methodology/benchmark_run.mjs --set S --modality B --pack benchmark_pack_B_S.json --repeats 2 --models llama-4-scout --confirm-authorized
node scripts/methodology/benchmark_run_cli.mjs --set S --modality B --pack benchmark_pack_B_S.json --repeats 2 --evaluators codex-gpt-6.2-sol,deepseek-v4.1-flash-opencode,gemini-4-hydrogen-agy --confirm-authorized
node scripts/methodology/benchmark_stage2.mjs
node scripts/methodology/benchmark_analyze.mjs --file docs/methodology/local/out/benchmark_S_B.jsonl --pack benchmark_pack_B_S.json
# Informe completo local
node scripts/methodology/build_full_report.mjs
```
`--confirm-authorized` representa la autorización expresa de la persona responsable: no debe pasarse sin ella.

## 12. Pendientes
1. Completar la etapa 1 de B (DeepSeek tras el reinicio de su cuota) y ejecutar la etapa 2 con la regla pre-registrada.
2. Reanudar Gemini 3.6 flash en A (cuota hasta el 26-nov 08:59).
3. Analizar por separado las celdas con la cita no recuperada, las 12 sin posición y las discrepancias prioritarias.
4. Segunda auditoría ciega de ítems (protocolo diseñado, no ejecutada); auditoría de silencio de las 59 celdas candidatas.
5. Validación humana independiente (2 evaluadores, ~150 celdas, después del 29-nov), adjudicación y propuesta de correcciones.
6. Entrevistas cognitivas y validez de contenido; informe metodológico público sin afirmar validación.
7. Nuevo release solo con autorización expresa; el merge a `main` requiere autorización expresa.

## 13. Trazabilidad
Issues #45–#58 (requisitos agrupados) y #59 (seguimiento y matriz). PR #60 `methodology-fase0` → `methodology-integration`. Commits clave: `8477830` (fases 0–1), `37c6afa` (flujo y Vercel), `03e0cd9` (criterios congelados), `b183a73` (arnés sin herramientas de memoria), `98d32f7` (interruptor por modelo), `c0cf652` (configuración de recuperación de B congelada).
