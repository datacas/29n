# Protocolo de la segunda auditoría de ítems, independiente y ciega (NO ejecutado)

Objetivo: contrastar los candidatos a doble contenido de la primera auditoría y detectar **falsos negativos** entre los ítems que se consideraron correctos. Los resultados de la primera auditoría son candidatos a revisión, no resultados validados.

## Diseño
- **Evaluadores:** Claude más modelos de ≥3 familias distintas servidos por OmniRoute (los elegidos en el benchmark reducido). Cada uno trabaja solo, sin ver a los demás ni la primera auditoría ni el feedback original.
- **Entrada por ítem:** texto de la pregunta, texto explicativo y la escala de respuesta. Nada más: ni partido, ni posiciones, ni ítems vecinos.
- **Alcance:** los **146** ítems, incluidos los que la primera pasada consideró correctos, en orden aleatorio distinto para cada evaluador.
- **Salida estructurada por ítem:** número de proposiciones independientes y cuáles son; contraejemplo (un posicionamiento coherente que ninguna respuesta pueda expresar) o «no encontrado»; dirección del «sí» definida o no; presuposiciones; términos cargados; si el contexto añade medidas o condiciones; comprensibilidad; posible redundancia con otro ítem (se le da la lista de textos solo en una segunda pasada).
- **Controles:**
  - *Control positivo*: la pregunta de sindicatos y organizaciones empresariales (regresión permanente) y versiones sintéticas de ítems limpios a las que se ha insertado un doble contenido conocido → mide la **sensibilidad** de cada evaluador.
  - *Control negativo*: ítems limpios sin cambios, y copias reescritas sin defecto → mide los **falsos positivos**.
  - *Repetición*: 10 % de ítems repetidos en otro orden → mide la estabilidad.
- **Sin pistas léxicas:** el prompt no menciona conjunciones ni «doble contenido» como regla sintáctica; pide razonar con contraejemplos.

## Análisis
- Acuerdo entre evaluadores (clase A frente a no-A: kappa/AC2; recuento por ítem) y frente a la primera auditoría; tasa de recuperación de los controles positivos.
- Ítems marcados por **al menos un** evaluador independiente → revisión humana; los marcados por ninguno se muestrean para auditoría (puede haber errores compartidos).
- La concordancia entre modelos no equivale a validez: la decisión final es humana.

## Resultado esperado
Lista priorizada de ítems para revisión humana con el contraejemplo y la propuesta de división, y estimación de la sensibilidad y especificidad de la auditoría automática. **No se divide, elimina ni reformula ninguna pregunta publicada sin autorización expresa.**
