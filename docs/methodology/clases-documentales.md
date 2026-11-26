# Clases documentales, intensidad y estados de ejecución (APROBADO 2026-11-25)

Tres ejes independientes. Una codificación se describe con los tres.

| Eje | Valores | Qué responde |
|---|---|---|
| **Estado de ejecución** (técnico) | `ok` · `api_error` · `timeout` · `rate_limited` · `document_unavailable` · `extraction_incomplete` · `search_failed` · `invalid_output` · `refused` | ¿Se pudo hacer la codificación? |
| **Clase documental** (solo si `ok`) | `supports` · `opposes` · `explicit_neutral` · `not_mentioned` · `ambiguous` | ¿Qué dice el documento? |
| **Intensidad ordinal** (solo según la clase) | `supports`: +1/+2 · `opposes`: −1/−2 · `explicit_neutral`: 0 · `not_mentioned`: NULL · `ambiguous`: NULL | ¿Cuánto? |

Reglas:
- Un fallo de API, un *timeout*, un documento inaccesible, una extracción incompleta o una búsqueda fallida **nunca** es `not_mentioned`: la ejecución queda en su estado técnico, sin clase ni intensidad, y la celda se reintenta o se marca como pendiente.
- `not_mentioned` ≠ `explicit_neutral` ≠ `ambiguous`. El silencio nunca es 0 (`scoring-methodology.md §2`).
- `explicit_neutral` ya existe en el sistema (`stance_status = 'explicit_neutral'`, `value = 0`) y en Jev (`neutral_explicit`).
- `ambiguous` incluye contradicción interna y condiciones que cambian la lectura; la causa se guarda en la justificación.
- La concordancia se mide por separado: clase (nominal; discrepancia de signo = `supports` frente a `opposes`) e intensidad (ordinal, solo cuando coincide la clase). Las ejecuciones fallidas se excluyen de la concordancia y se informan como tasa de fallo por evaluador.
- Compatible con el scoring actual, que solo usa `value` y `stance_status`.
- La restricción está en la base de datos: `db/migrations/009_position_codings.sql` impide combinaciones incoherentes.
