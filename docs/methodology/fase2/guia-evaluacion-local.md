# Guía: evaluación humana ciega en el panel local

## Acceso
1. Base de datos y panel locales en marcha (`docker start 29n-db-1`; `npm run dev`).
2. Entra en `/admin` con tu acceso habitual (correo + OTP) y abre **Revisión → Evaluación humana** (`/admin/evaluacion`).
3. Tu evaluador es **«Humano interno 1»** (afiliación interna, vinculado a tu credencial). El piloto está creado: «Piloto 19 celdas — modalidad B (conjunto S)».

## Cómo evaluar
- Ves la pregunta, el contexto y los pasajes (con página). No ves el partido, la referencia provisional, respuestas de IA ni evaluaciones ajenas; el servidor no las envía.
- No hay nada preseleccionado. Elige clase documental (`1`–`5`), intensidad cuando procede (`F` fuerte, `M` moderada; `explicit_neutral` = 0 automática), marca las evidencias que sostienen la decisión y escribe la justificación.
- **Contexto insuficiente** (`I`): puedes marcarlo sin emitir clase. «Pedir más contexto» registra la petición; «Ampliar con páginas contiguas» crea una **versión nueva** de la celda (los pasajes anteriores conservan su posición; la versión original no se modifica). Si ampliaste el contexto tras guardar un borrador, la interfaz te avisa para que lo revises.
- **Guardado automático** tras 800 ms; la barra de estado muestra «Guardando…», «✔ Guardado hh:mm:ss», «● Cambios sin guardar…» o el error de persistencia (con reintento automático y botón «Reintentar»). Si otra pestaña modificó el borrador, verás «Conflicto de edición» y podrás recargar. Al recargar o volver se recupera el borrador.
- Navegación: `←` / `→`, «Siguiente pendiente», filtro (todas, pendientes, con borrador, finalizadas, contexto pedido) y **«Revisar antes de finalizar»** (tabla con tu decisión por celda y las incompletas resaltadas).
- **Finalizar** (`Ctrl+Enter`, con confirmación) es **irreversible**: se añade una fila a `position_codings` (humano, interno, ciego, versión de celda y manual) y el borrador se bloquea. Para corregir un error posterior hay que hacer una repetición en una campaña nueva (se conservan ambas).

## Adjudicación en sombra (`/admin/adjudicacion`)
Tras finalizar tu evaluación de una celda puedes adjudicarla **sin ceguera**: ves pregunta y contexto, manual, **programa original** (páginas relevantes y contiguas, con enlace al PDF en la página), cita registrada, pasajes recuperados, tu evaluación, cada IA y la referencia provisional, y las discrepancias detectadas (incluida la comprobación de si la cita registrada aparece en lo recuperado).
- La cola se construye con `node scripts/methodology/build_adjudication_dossiers.mjs --apply` (celdas con discrepancia, posibles omisiones y diferencias de intensidad; prioridad 16, 12, 6, 15, 3, 19, 7, 10).
- Registra clasificación (o «sin resolver»), **una o varias causas**, justificación, evidencia verificada y una propuesta informativa sobre el banco. No hay nada preseleccionado ni se resuelve por mayoría.
- Cada decisión es una **revisión nueva** (solo añadir; la anterior se conserva) y queda **en sombra**: `applied` es siempre falso y **no modifica `positions` ni el banco**. Aplicar requiere autorización expresa.

## Repetibilidad intraevaluador (más adelante)
Tras un tiempo (se recomiendan ≥ 7 días) puedes repetir una muestra aleatoria sin ver tus respuestas anteriores:
```
node scripts/methodology/create_repeatability_campaign.mjs --source <id_campaña> --n 10            # simulación
node scripts/methodology/create_repeatability_campaign.mjs --source <id_campaña> --n 10 --apply
```
Orden y etiquetas nuevos; ambas evaluaciones quedan en `position_codings` (campañas distintas) y podrán compararse con kappa ponderado, Krippendorff, etc. **No equivale a fiabilidad entre humanos independientes.**

## Limitaciones que deben constar en los informes
- Tus evaluaciones son **humanas internas**, no una referencia humana independiente; no se puede afirmar concordancia humano–humano independiente.
- Las 19 celdas son una **muestra dirigida** (sesgo de selección): no se extrapolan al banco ni validan 29N.
- Ceguera **parcial**: conoces el proyecto, y los textos de los programas pueden delatar el partido (estimación aproximada: en 9 de 19 celdas aparece alguna palabra distintiva del nombre del partido en los pasajes).
- Métricas disponibles: IA–IA y humano interno–IA (Krippendorff nominal/ordinal, kappa ponderado, Gwet AC1/AC2…). El panel de métricas y la adjudicación avanzada son la siguiente fase.

## Crear de nuevo o recuperar
`node scripts/methodology/create_eval_campaign.mjs [--apply]` (aborta si la campaña ya existe). Antes de cualquier migración o campaña: `bash scripts/backup-db.sh`.
