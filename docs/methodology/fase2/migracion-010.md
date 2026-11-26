# Migración 010 — evaluación humana ciega en el panel local (solo BD local)

> **ERRATA 2026-11-25 (D26).** Las evaluaciones ciegas y las adjudicaciones del piloto registradas como «Humano interno 1» las produjo **un agente de IA que operaba esa cuenta**, no una persona (declaración del propio agente; corroborada por los tiempos: 19 evaluaciones en 54 s). Por tanto el piloto **no es una validación humana**: las comparaciones «humano interno–IA» de este piloto son **IA–IA**, y las adjudicaciones y las decisiones sobre el manual v0.2 que se le atribuyeron **no están ratificadas por la persona responsable**. El piloto sí vale como prueba de la interfaz, de la trazabilidad y del procedimiento. Ver D26 en `proceso-completo.md`.

Migración **aditiva** (`db/migrations/010_evaluation.sql`) para la BD local. No se aplica en Neon ni en producción; no toca `positions`, el banco de preguntas, el scoring, los releases ni el conjunto E.

## Qué cambia
**`position_codings` (009)** — columnas nuevas con valores por defecto neutros: `insufficient_context boolean`, `campaign_id`, `evaluator_id`, `revision`, `cell_version`. Se sustituye la restricción `position_codings_status_class`:

| Antes | Ahora |
|---|---|
| `(execution_status = 'ok') = (document_class IS NOT NULL)` | `ok` ⇒ clase **o** `insufficient_context`; fallo técnico ⇒ ni clase ni `insufficient_context` |

Decisión metodológica: **«contexto insuficiente» es una conclusión del evaluador, no un estado técnico**. `execution_status` sigue describiendo solo la ejecución (`ok`, `timeout`…); `insufficient_context` es un campo aparte que puede ir sin clase (no se obliga a puntuar) o acompañando a una. Las filas anteriores (ninguna humana) cumplen la restricción nueva. Índice único `(campaign_id, evaluator_id, question_id, entity_id, revision)`.

**Tablas nuevas:** `eval_evaluators` (etiqueta, `internal`/`external`, activo, correo y credencial opcionales: preparado para externos sin implementar su acceso), `eval_campaigns` (tipo `pilot`/`repeatability`/`main`, manual, método de selección y sesgo documentados), `eval_cells` (celda ciega; `party_name` solo lo lee la administración; `extra_context` precalculado), `eval_cell_versions` (instantáneas **inmutables y versionadas**), `eval_assignments`, `eval_drafts` (mutables hasta finalizar; sin valores por defecto de clase ni intensidad), `eval_context_requests`, `eval_adjudications` (solo añadir; la propia BD exige haber finalizado antes la evaluación propia de la celda), `eval_audit` (solo añadir).

Las evaluaciones **finalizadas** viven en `position_codings` (solo añadir). Un borrador finalizado no se puede modificar ni borrar (disparador).

## Procedimiento seguido (2026-11-25)
1. Copia de seguridad: `bash scripts/backup-db.sh`.
2. Validación en BD temporal (`CREATE DATABASE tmp_010 TEMPLATE affinity`): aplicación, reaplicación idempotente y `docs/methodology/fase2/test_migration_010.sql` (28 comprobaciones, todas correctas).
3. Aplicación en `affinity` y `affinity_test`. Verificado: `positions` sin cambios (2969 filas).

## Recuperación
- Completa: `pg_restore` de la copia previa (`~/backups/29n/affinity-<fecha>.dump`).
- Parcial (si no hay evaluaciones registradas): `DROP TABLE eval_* CASCADE; DROP FUNCTION eval_append_only, eval_drafts_guard, eval_adjudication_gate;` y volver a la restricción de 009 con las columnas nuevas descartadas. Con evaluaciones humanas registradas, usar la copia: `position_codings` es de solo añadir.
