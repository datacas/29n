# Revisión editorial previa al release — 21 nov 2026

## Decisión ejecutiva

**Recomiendo preparar la publicación con los 17 partidos actuales; no retrasarla para buscar un partido número 18.** Antes de publicar, aplicar y comprobar las 54 decisiones de `review_54_decisions.json`, regenerar el candidato y revisar sus advertencias. No publicar el candidato actual sin esa pasada final: sigue siendo un borrador y sus posiciones dudosas aún no están resueltas.

Las 54 no son 54 partidos ni una mejora de cobertura garantizada: son celdas posición-partido ya existentes que requieren dictamen. La revisión propuesta las distribuye así:

| Resolución | Cantidad | Tratamiento |
|---|---:|---|
| Aprobar con valor | 42 | Aprobación directa, parcial o condicional |
| Aprobar como no evaluable | 6 | Contradicción, ambigüedad o pregunta no comparable; sin valor de scoring |
| Rechazar la evidencia para esa pregunta | 6 | La cita no responde a la pregunta o el documento no es el programa electoral vigente |

El dry-run de `scripts/release/apply_review_decisions.ts` encontró las 54 posiciones, no modificó la BD y proyecta 276 celdas editorialmente aprobadas: 270 evaluables con valor y 6 excluidas del scoring. Se mantienen los 17 partidos que ya tienen posiciones aprobadas; PCTE no entra porque sus tres citas vienen de un programa de lucha 2023–2027, fechado en 2023, no de un programa electoral comparable de 2026.

## Partidos prioritarios

- **Adelante Andalucía (9):** las nueve evidencias son pertinentes. Aprobar las nueve; Q007 conservar solo la evidencia sobre rehabilitar sin consumir suelo y descartar la cita sobre tejados/placas solares.
- **SALF (4):** aprobar Q009, Q012 y Q024; excluir Q022 como no comparable (el referéndum es una propuesta concreta sobre la UE, no una ampliación general de participación directa). Para Q012 sustituir el eslogan por la medida concreta de mínimo exento por hijo.
- **PNV (6):** aprobar cinco con valor parcial; Q024 excluirla como no comparable, porque habla de regularizaciones ya previstas legalmente, no de una regularización extraordinaria.
- **Democracia21 (5):** aprobar Q002, Q006, Q022 y Q032 (dos con condición); rechazar Q012, ya que la evidencia explica la financiación del Bono Crianza, no una ampliación de deducciones.
- **Partido Autónomos (5):** aprobar cuatro con apoyo parcial/condicional; rechazar Q026, porque la cita se refiere a expulsar delincuentes extranjeros multirreincidentes, no a devoluciones por entrada irregular.

## Muestra de 15 posiciones aprobadas

Tomé una posición aprobada por partido en 15 partidos y cotejé literalmente cada cita con el PDF y la página indicada. **Las 25 citas de la muestra aparecen en el documento y en esa página.** Las posturas de la muestra son en general coherentes con la evidencia, pero hay dos advertencias editoriales:

1. **PSOE Q022:** la primera cita (“reducir las firmas necesarias para la iniciativa legislativa popular”) es claramente favorable a ampliar la participación, aunque el extractor la marcó `disagrees`. El valor editorial +2 tiene sentido; corregir o quitar esa etiqueta para que no contradiga la evidencia.
2. **Frente Obrero Q003:** la construcción de vivienda pública apoya la pregunta, pero una cita asociada atribuye presión de demanda a la inmigración. Es contexto político del partido, no evidencia necesaria para codificar esta política. Recomiendo conservar la primera cita y quitar esa segunda del soporte de la posición.

Muestra (partido / pregunta): Adelante Andalucía Q032; BNG Q008; Democracia21 Q023; EH Bildu Q024; ERC Q018; FE de las JONS Q009; Frente Amplio Q005; Frente Obrero Q003; PACMA Q015; PNV Q032; PSOE Q022; Partido Autónomos Q030; SALF Q005; Sumar Q017; Vox Q016.

## Cobertura y publicación

- El candidato actual `1.0.0-rc2` ya contiene 32 preguntas (Q021 se excluye por la decisión editorial ya documentada) y los 17 partidos. Hay cuatro candidatos en BD: `rc1` y `rc2` están en borrador; **no hay un release electoral publicado** (solo la demo publicada).
- La cobertura aprobada actual va del 3 % de SALF y 6 % de Adelante Andalucía al 79 % del PSOE, sobre 32/33 celdas por partido. Después de aplicar la revisión, SALF seguiría con cobertura baja: aproximadamente 4 celdas aprobadas de 32 (12,5 %), una de ellas no evaluable; Adelante Andalucía subiría a 11/32. Mostrar la cobertura y la advertencia, sin ocultar el resultado.
- Para crear un borrador el script estricto detecta otras celdas `draft` sin evidencia; el flujo actual permite un candidato parcial con `--allow-unresolved`. No debe confundirse falta de evidencia/posición con aprobación ni asignarse valor neutral por defecto.
- **Recomendación final:** publicar una vez aplicadas las decisiones, regenerado el manifiesto inmutable y comprobados el enlace público y las advertencias de cobertura. No esperar a ampliar la lista de partidos; sí esperar a cerrar esta revisión editorial.

## Verificación técnica

- Los 54 dictámenes están en `docs/review_54_decisions.json` (con páginas, razones, condiciones y sustituciones de citas cuando hacen falta).
- `scripts/release/apply_review_decisions.ts` incluye dry-run por defecto y solo escribe con `--apply`; no se ejecutó con `--apply` ni se modificó la base de datos.
- `npm test -- --run`: 140 pasaron, 4 omitidos y 18 fallaron. Un test falla por diferencia de forma (`translation: null` añadido a evidencia); 17 pruebas de integración se atascaron en timeout al conectar con su BD de test. Los tests de scoring/calibración sí pasaron. Resolver/verificar estas incidencias antes de considerar el release listo.
