# Migración 009 — `position_codings` (solo local)

Tabla de **solo añadir** con las codificaciones de varios evaluadores por celda (pregunta × partido). `positions` sigue siendo el resultado adjudicado y no se modifica. No se aplica en Neon ni en producción.

## Qué crea
- `position_codings` (una fila por celda, evaluador y ejecución) con: evaluador (tipo, proveedor, familia, modelo pedido y **modelo real**, uso de *fallback*, ceguera y a quién no vio), versiones (huella del texto del ítem y del contexto, manual, prompt, documento), estado de ejecución, clase documental, intensidad, evidencia, justificación y consumo.
- Restricciones: la clase existe solo si la ejecución es `ok`; la intensidad debe ser coherente con la clase.
- Disparadores que rechazan `UPDATE`, `DELETE` y `TRUNCATE`.
- Índices por celda, ejecución y evaluador. Sin claves ajenas hacia `positions`: no hay efecto sobre ella.

## Procedimiento seguido (2026-11-25)
1. Copia de seguridad: `bash scripts/backup-db.sh` → `~/backups/29n/affinity-<fecha>.dump` (pg_dump -Fc).
2. Prueba en una BD temporal con el esquema copiado (`pg_dump --schema-only`): aplicar 009 dos veces (idempotencia) y ejecutar `docs/methodology/fase1/test_migration_009.sql` → 12 de 12 pruebas pasan.
3. Aplicación en `affinity` (desarrollo) y `affinity_test`. Comprobación: `positions` conserva 2.969 filas en `affinity`; la suite `vitest` (195 pruebas) sigue en verde.
4. BD temporal eliminada.

## Recuperación
- Deshacer solo la migración (no afecta a nada más):
  ```sql
  DROP TABLE IF EXISTS position_codings;
  DROP FUNCTION IF EXISTS position_codings_append_only();
  ```
  (El disparador de `TRUNCATE`/`DELETE` impide vaciarla por error; `DROP TABLE` es el camino deliberado.)
- Restaurar el estado anterior completo: `docker exec -i 29n-db-1 pg_restore -U app -d <base_nueva> --no-owner < ~/backups/29n/affinity-<fecha>.dump` y luego renombrar o repuntar.
