# Matriz de trazabilidad: 31 requisitos originales → 14 issues

Fuente: tabla de issues del §19 del encargo. «Diferido» = no tiene issue propio por decisión explícita.

| # | Requisito original | Prio | Issue |
|---|---|---|---|
| 1 | Auditoría lógica del banco de preguntas | P0 | #45 |
| 2 | Validación de atomicidad | P0 | #45 |
| 3 | Detección de doble contenido | P0 | #45 |
| 4 | Vacíos de respuesta por contraejemplos | P0 | #45 |
| 5 | Sesgos y presuposiciones | P0 | #45 |
| 6 | Validación de textos explicativos | P0 | #45 |
| 7 | Manual de codificación por ítem | P0 | #46 |
| 8 | Versionado de manuales | P0 | #46, #47 |
| 9 | Evaluación independiente con múltiples IA | P0 | #48 |
| 10 | Evaluación ciega humana | P0 | #55 (piloto) |
| 11 | Alfa de Krippendorff ordinal | P0 | #49 |
| 12 | Kappa de Cohen ponderado | P1 | #49 |
| 13 | Métricas complementarias de desacuerdo | P0 | #49 |
| 14 | Panel de discrepancias | P0 | #50 (cola) · #58 (panel) |
| 15 | Procedimiento de adjudicación | P0 | #50 |
| 16 | Auditoría aleatoria de concordantes | P0 | #50 |
| 17 | Validación de contenido con expertos | P1 | #56 |
| 18 | V de Aiken | P1 | #56 |
| 19 | Análisis de sensibilidad | P0 | #51 |
| 20 | Impacto de dividir preguntas en ponderaciones | P0 | #51 |
| 21 | Estabilidad del ranking | P0 | #51 |
| 22 | Pruebas metodológicas de regresión | P0 | #54 |
| 23 | Pruebas piloto con usuarios | P1 | #56 |
| 24 | Entrevistas cognitivas | P1 | #56 |
| 25 | Test-retest | P1 | #56 (estabilidad de usuarios) · #49 (repetición de un mismo evaluador) |
| 26 | Evaluación psicométrica de dimensiones | P2 | Diferido: #49 documenta por qué Cronbach/AF no se aplican y bajo qué condiciones se reconsideraría |
| 27 | Panel administrativo de calidad | P1 | #58 |
| 28 | Publicación de informes metodológicos | P1 | #57 |
| 29 | Versionado de resultados de validación | P0 | #47 |
| 30 | Regresiones entre modelos de IA | P1 | #48 (benchmark de modelos) · #55 |
| 31 | Comunicación de incertidumbre al usuario | P2 | Diferido: #51 entrega la propuesta fundamentada; #57 la documenta. No se implementa en la interfaz |

## Requisitos añadidos en esta ronda y dónde viven

| Precisión (15 puntos del encargo) | Issue |
|---|---|
| 1 Trazabilidad | este documento |
| 2 Independencia de modelos, registrar el modelo real y fallbacks | #48 |
| 3 JEV verificador frente a codificador | #48, #53 |
| 4 Codex no es referencia dorada | #48, #55 |
| 5 Clases documentales + intensidad separada | #47, #48 (`clases-documentales.md`) |
| 6 Piloto de 150 celdas con dos externos y adjudicador | #55 |
| 7 Muestreo representativo y de casos conflictivos, informes separados | #50, #55 |
| 8 Simulación de sensibilidad multi-escenario y reproducible | #51 |
| 9 Ponderaciones: medir, no modificar | #51 |
| 10 Verificación documental en seis niveles | #53 |
| 11 Métricas informan y priorizan, no bloquean por umbral | #49, #53 |
| 12 Asimetría del 86 % | #52 |
| 13 Auditoría de ítems y Q49 como regresión | #45, #54 |
| 14 Trabajo en sombra, artefactos versionados | todas (restricción) |
| 15 Documentación pública sin afirmar validación | #57 |
| OmniRoute: inventario, benchmark y estrategia escalonada | #48, #55 |
