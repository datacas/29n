# Migración 011 — adjudicación en sombra (solo BD local)

Aditiva, sobre 010. No modifica `positions`, el banco, el scoring ni los releases. `eval_adjudications` estaba vacía al aplicarla.

## Qué cambia
- **`eval_adjudication_items`** (nueva): cola de celdas a adjudicar con su prioridad, motivos y **expediente** (referencia provisional y cita registrada, respuestas de cada IA, tu evaluación, discrepancias, comprobación de recuperación, páginas del programa original). Se construye con `scripts/methodology/build_adjudication_dossiers.mjs` y es reconstruible.
- **`eval_adjudications`** (ampliada): `revision`, `causes text[]` (≥ 1, del catálogo de 11), `other_cause_text`, `proposed_action` (informativa), `evidence`, `own_coding_id`, `manual_version`, `cell_version`, `applied` (CHECK `applied = false`: aplicar al banco exige autorización expresa y una migración posterior). Restricciones: clase/intensidad coherentes, justificación no vacía, revisiones consecutivas (disparador). Sigue siendo de solo añadir y exige haber finalizado antes la evaluación propia de la celda (disparador de 010).

**Catálogo de causas:** error de recuperación, error de interpretación, error de intensidad, evidencia insuficiente, evidencia contradictoria, pregunta ambigua o defectuosa, manual insuficiente, posición omitida, posición registrada sin respaldo suficiente, desacuerdo razonable, otra (con texto). Se pueden registrar varias.

## Procedimiento seguido (2026-11-25)
Copia de seguridad → validación en BD temporal (aplicación, reaplicación idempotente y `test_migration_011.sql`: 15/15) → aplicación en `affinity` y `affinity_test`. `positions` sin cambios (2969).

## Recuperación
Copia previa (`~/backups/29n/affinity-<fecha>.dump`) o, sin adjudicaciones registradas, `DROP TABLE eval_adjudication_items` y eliminar las columnas y restricciones añadidas.
