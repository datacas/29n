# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing codebase: Nuxt 3 (srcDir `app/`), Vue 3, Pinia, @nuxtjs/i18n, Nitro. Renderizado en servidor con hidratación. El panel de administración (`app/pages/admin`, layouts `admin` y `plain`) queda fuera del rediseño.

## Users
Votantes de España, de cualquier edad y nivel digital, que abren un enlace compartido **desde el móvil**, en pocos minutos y a pocos días de las elecciones generales del 29 de noviembre de 2026. Quieren saber con qué partido coinciden más según lo que dicen sus programas. Muchos no conocen los programas ni la jerga política. Es una herramienta de un solo uso, sin cuenta ni registro.

## Product Purpose
Una aplicación de afinidad electoral (VAA). La persona contesta preguntas (de −2 «totalmente en desacuerdo» a +2 «totalmente de acuerdo») y obtiene un porcentaje de afinidad con los programas de 19 partidos. Cada posición de partido está respaldada por una cita literal del programa con su página. El éxito es que la persona entienda el resultado, sepa de dónde sale y no se sienta guiada hacia ningún partido.

## Positioning
Lo que otro producto no podría copiar con verdad: cada porcentaje se apoya en citas literales verificables del programa, con página, y la herramienta dice abiertamente qué partidos tienen pocos datos y qué no sabe. No recomienda voto.

## Operating Context
- Flujo: inicio → elegir partidos y profundidad (rápida, normal, profunda o total) → prioridades por comparación de temas (9 comparaciones) → preguntas (de 16 a más de 50, el número depende de los partidos elegidos) → resultados con evidencia.
- Cada pregunta lleva un texto de contexto plegable («¿Qué significa esto?») y un selector de importancia opcional.
- Los resultados y el progreso se guardan solo en el navegador (IndexedDB). No hay cuentas. Hay estadísticas de uso anónimas (sin IP ni respuestas) que respetan «No rastrear».
- Hay una página «Cómo funciona» (`/metodologia`) y un historial local de resultados.
- Las citas de programas en gallego, catalán y valenciano se muestran traducidas al castellano, con el original.
- Los partidos siempre se listan en orden alfabético.

## Capabilities and Constraints
- Interfaz solo en castellano.
- La release publicada es inmutable y su contenido está congelado en un manifiesto. El diseño no puede cambiar datos, preguntas ni la lógica de cálculo.
- Debe ser rápido en móvil y con mala conexión: los datos de una encuesta pesan unos 150 KB comprimidos, y el JavaScript inicial unos 100 KB.
- Elecciones el 29 de noviembre de 2026. Plazo muy corto.
- Terminología fija: «afinidad», «posición», «evidencia», «Pocos datos», «posición conocida en X de Y preguntas».
- Neutralidad política: ningún color, orden, tamaño ni énfasis puede sugerir preferencia por un partido. No se usan colores de partidos como identidad de la interfaz.
- Hasta 19 partidos en pantalla a la vez, y cada uno con nombre, porcentaje, cobertura y evidencia desplegable.

## Brand Commitments
Marca neutra, sin entidad detrás: el nombre del proyecto es «29N». No hay logo ni colores de marca preexistentes. La identidad la define el rediseño y debe ser sobria, institucional sin ser oficialista, y comprensible para cualquiera. Voz: llana y directa, frases cortas, sin jerga ni tono de IA, sin punto y coma en los textos.

## Evidence on Hand
- Datos reales en la base de datos: 109 preguntas, 19 partidos, más de 800 posiciones con cita y página. Citas con traducción.
- Capturas del flujo actual se pueden obtener ejecutando la aplicación en `http://localhost:3099`.
- No hay testimonios, logos de partidos, ni imágenes de marca. No se debe inventar ninguno.
- No hay datos de uso real todavía.

## Product Principles
1. **Mostrar de dónde sale cada cosa.** Cada porcentaje se puede seguir hasta una cita con página.
2. **Neutralidad visible.** El diseño no inclina la balanza: mismo trato visual para todos los partidos.
3. **Honestidad sobre lo que no se sabe.** «Pocos datos» y «posición no conocida» se dicen claro, no se esconden.
4. **Móvil primero, tiempo corto.** Una mano, pantalla pequeña, mala conexión, pocos minutos.
5. **Lenguaje de cualquiera.** Sin jerga. Se explica la pregunta antes de pedir la opinión.

## Accessibility & Inclusion
WCAG 2.2 AA como mínimo: contraste, navegación por teclado, lector de pantalla, objetivos táctiles amplios, texto ampliable sin romper el diseño, respeto de `prefers-reduced-motion` y de los modos de contraste y color del sistema. Público de todas las edades: tipografía legible y sin información solo por color.
