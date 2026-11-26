# Prueba local de la segmentación v2 de recuperación (B-2.0.0) sobre el piloto — resultados agregados

Fecha: 2026-11-25. Configuración: `retriever-config-B2.json` (idéntica a B-1.0.0 salvo la segmentación; B-1.0.0 sigue congelada y no se modifica). Implementación: `scripts/methodology/retrieval_v2.mjs`, `retrieval_v2_export.mjs`, `retrieval_v2_build.py`, `retrieval_v2_compare.mjs`. **Sin llamadas a modelos de lenguaje**: el vocabulario por ítem es el ya generado; BGE-M3 y bge-reranker-v2-m3 se ejecutan en local (GPU). Solo celdas del conjunto S (19 del piloto); E sellado. Detalle por celda en local (`docs/methodology/local/out/v2/`).

## Qué cambia
Los fragmentos que terminan cortados a mitad de frase (sin puntuación final y con continuación evidente) se amplían con los párrafos siguientes hasta cerrar la frase, también entre páginas (máx. 3 fusiones y 900 caracteres adicionales). En los 11 programas de las celdas del piloto, entre 1 y 59 fragmentos por programa se ampliaron (p. ej. 59 de 288 en un programa en gallego, 40 de 262 en otro).

## Resultados (n pequeño; muestra dirigida)
- **Cita registrada en lo recuperado** (comprobación sistemática): de las 4 celdas del piloto donde la referencia registraba una cita que **no** estaba en los 10 pasajes con la v1, la v2 la recupera en **1** (la causada por un fragmento cortado entre páginas). Las otras 3 siguen sin recuperarla.
- **Evidencias verificadas por el responsable en el PDF** (12 evidencias en 6 celdas adjudicadas): encontradas en el top-10 con v1 **8/12**, con v2 **10/12**. Las dos nuevas son una de la celda del fragmento cortado y una de la celda donde faltaban páginas enteras; en esta última **siguen sin recuperarse** otras dos evidencias (páginas distintas): ahí el límite no es el corte de fragmentos sino la cobertura del top-10.
- **Estabilidad:** el top-10 cambia en la mayoría de celdas (solo 3 de 19 idénticos; en 11 de 19 hay algún pasaje ampliado entre los 10 entregados; 2 celdas con cambios casi totales, ambas en programas con muchas ampliaciones). La segmentación v2 **no es una mejora neutra**: reordena lo que ven los evaluadores.

## Conclusiones prudentes
- Ampliar fragmentos cortados corrige una clase concreta de fallo (cita separada por salto de página) y mejora algo la recuperación de evidencias verificadas, pero **no resuelve** los fallos por cobertura (evidencias en páginas que el top-10 no trae).
- No se puede deducir efecto sobre la clase ni la intensidad: eso exigiría recodificar (modelos o humanos). No se hace.
- **La comprobación sistemática «¿está la cita registrada en lo recuperado?» es independiente de la segmentación y se recomienda en cualquier configuración**, antes de comparar evaluadores.
- Cualquier uso de B-2.0.0 en una ejecución de modelos o en la campaña de ~150 celdas requiere decisión expresa; los resultados de B (con B-1.0.0) no cambian.
