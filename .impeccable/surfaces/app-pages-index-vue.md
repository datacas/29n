---
version: 1
slug: "app-pages-index-vue"
primary_target: "app/pages/index.vue"
related_targets: ["app/pages/history.vue","app/pages/metodologia.vue","app/pages/survey/[slug]/start.vue","app/pages/survey/[slug]/calibration.vue","app/pages/survey/[slug]/questions.vue","app/pages/survey/[slug]/results.vue"]
---

# Surface brief: cuestionario público (todas las rutas fuera de /admin)

Visitor mode: Operate. La persona completa una tarea (elegir partidos, contestar, leer el resultado) en el móvil, en pocos minutos.

## Audience and task
Público general de España, de cualquier edad, desde el móvil y con mala conexión. Quiere saber con qué programa coincide y de dónde sale el porcentaje. No hay cuenta ni registro.

## Direction contract

THESIS: La herramienta se lee como una etiqueta de eficiencia energética: un resultado ordenado, de barras en flecha proporcionales, contorno grueso y datos con su fuente a la vista. Rechaza la tarjeta blanda con sombra y el ranking tipo podio.

OWN-WORLD: Azul de cabecera #0a3a78 con una gama azul única para las barras (nunca verde-rojo), blanco, tinta #0b1b33, un solo amarillo UE #ffd400 para la acción primaria y la marca de «tu coincidencia». Contornos de 2 px en tinta, radio 6 px, sin sombras. Tipografía Barlow Condensed en versalitas para cabeceras de tarjeta y cifras, y Barlow para el texto. Barras en flecha con clip-path, reconocibles aunque no haya texto.

STORY: La persona entiende en la primera pantalla qué hace la herramienta, elige partidos con casillas grandes, avanza por cuatro pasos siempre visibles (Partidos, Prioridades, Preguntas, Resultados), contesta con explicación a mano y llega a un resultado donde cada porcentaje se puede seguir hasta su cita. Acción: «Empezar» y después «Ver resultados».

FIRST VIEWPORT: En móvil (390 px), cabecera azul con el título «¿Con qué programa coincides más?» y una línea de explicación, la tarjeta de partidos con casillas de 44 px y una flecha que mide las posiciones documentadas de cada partido, el selector de profundidad en tres segmentos y el botón amarillo «Empezar» fijo abajo con el número de preguntas.

FORM: Etiqueta de eficiencia energética de la UE, posición 4 de la lista (la tirada). Mover de seed:a215e9a5a7344079. Se ha elegido el boceto assigned.html. Donaciones: de la cartera de billetes, el indicador de paso siempre visible con lo que falta, y de Datamática (Ikeda) la disciplina de rejilla con un solo grosor de línea.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved
Ninguna decisión abierta. El panel de administración queda fuera.
