# Autoría material y autorización de los registros (migración 013)

**Principio (decisión de la persona responsable, 2026-11-26):** se distingue el **autor material** de una evaluación o adjudicación del **responsable que la autoriza**. Una decisión registrada por un agente de IA bajo autorización **no aparece como una evaluación humana realizada personalmente** por la persona responsable.

**Implementación.** Los registros originales (`position_codings`, `eval_adjudications`) son inmutables, así que la autoría se anota aparte en `eval_authorship` (solo añadir; vale la última anotación): tipo de autor (`human`, `human_with_agent_support`, `ai_agent`, `unverified`), etiqueta, quién autoriza y nota. Cada evaluación finalizada y cada adjudicación nueva nace con autoría `unverified` y puede anotarse después. La procedencia por campaña sigue en `eval_provenance` y las métricas solo cuentan como humanas las filas `human_verified`.

**Anotación de lo existente** (`scripts/methodology/backfill_authorship.mjs`): evaluaciones y adjudicaciones del piloto → `ai_agent`, autoriza la persona responsable; recodificación de 8 celdas → `human_with_agent_support` (declaración de la persona); revisión 2 de la celda 12 → registrada por el agente por autorización expresa de la persona responsable (2026-11-26). La pantalla de adjudicación muestra el autor material y quien autoriza en el historial.

**Append-only:** las evaluaciones originales y sus revisiones se conservan; ninguna anotación de autoría sobrescribe otra.
