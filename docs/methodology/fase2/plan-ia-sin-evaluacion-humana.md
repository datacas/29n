# Plan: continuar la revisión metodológica solo con IA (sin evaluación humana) — PROPUESTA, SIN EJECUTAR

Fecha: 2026-11-26. Decisión de la persona responsable: **no habrá evaluación humana** (no hay tiempo); todo se hará con IA. Este documento fija qué se puede y qué no se puede afirmar, y propone cómo continuar sin simular lo que no existe. **No se ha lanzado ninguna llamada a modelos**: A y B siguen cerrados y cualquier ejecución nueva requiere autorización expresa con alcance concreto.

## 1. Qué cambia en lo que se puede afirmar
- **Se puede afirmar:** concordancia entre codificadores de IA (varios modelos, con evidencia y manual fijos), sensibilidad del ranking a las codificaciones, consistencia del procedimiento, errores detectables de forma determinista (cita no literal, cita registrada fuera de lo recuperado, intensidad frente a manual), y que la codificación es **asistida por IA**.
- **NO se puede afirmar:** validación humana, referencia humana, concordancia humano–humano ni que las posiciones estén «verificadas por personas». El feedback original pedía fiabilidad entre codificadores y validación humana: la primera se puede aproximar entre modelos independientes; **la segunda queda sin cubrir** y debe constar así en cualquier informe o texto público.
- Los registros marcados «humano interno» del piloto, de la recodificación de 8 celdas y de la campaña de 150 se tratan como **IA (agente)**, con su procedencia anotada.

## 2. Qué se puede hacer sin humanos y con integridad
1. **Panel de IA multi-modelo sobre las 146 celdas** con el manual v0.2 congelado y los paquetes de evidencia congelados (B-1.0.0): al menos 3 familias de modelos distintas, cada una sin ver a las demás, con los mismos guardas del benchmark (huella del prompt, modelo real frente a pedido, exclusión de *fallback*, separación de estados técnicos). Métricas: Krippendorff nominal y ordinal, kappa ponderado, Gwet AC1/AC2 con IC; R con pesos de diseño.
2. **Comprobaciones deterministas** (sin modelos): cita literal por niveles, cita registrada en lo recuperado, intensidad coherente con el manual, ausencia confirmada en el programa completo (búsqueda con términos registrados).
3. **Verificación por un modelo distinto del codificador** solo para discrepancias, con el texto completo de las páginas relevantes. **No se resuelve por mayoría ni automáticamente**; el resultado se etiqueta «adjudicado por IA, sin verificación humana».
4. **Impacto en sombra** de lo propuesto sobre el banco y sobre el ranking (con el modelo de scoring público), como análisis de sensibilidad.
5. **Cualquier cambio real del banco** (`positions`, release) sigue exigiendo **orden expresa** de la persona responsable, que responde de él aunque no codifique.

## 3. Autoría y trazabilidad
Cada registro conserva su autor material (modelo, versión real, proveedor), el responsable que autoriza y la huella de manual, prompt y evidencia (`position_codings`, `eval_authorship`, `eval_provenance`). Las marcas de tiempo se comprueban contra las fuentes inmutables (`integrity_check.mjs`).

## 4. Controles contra repetir el incidente I21
- La aplicación no debería conectarse como superusuario: propuesta de rol de base de datos sin privilegios de desactivar disparadores ni de saltarse `session_replication_role`.
- `integrity_check.mjs` como paso previo a cualquier informe; las cifras se calculan con `position_codings.created_at`, nunca con marcas mutables.
- Ninguna etiqueta «humano» sin procedencia verificada por una fuente independiente de quien la afirma.

## 5. Decisiones pendientes
1. **Autorización específica para llamar a modelos:** qué modelos y proveedores (p. ej. los de la pasarela local ya usados), tope de coste (0 € con modelos gratuitos), número de celdas (146) y repeticiones.
2. ¿Se añade una verificación de discrepancias por un modelo distinto, con texto completo de página?
3. ¿Se crea el rol de base de datos sin superusuario para la aplicación?
4. Redacción de la limitación pública: «codificación asistida por IA, sin validación humana independiente».
