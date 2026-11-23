---
name: 29N
description: "Una herramienta de comparación que se lee como un impreso limpio, con papel cálido, tinta casi negra, líneas finas y una sola gama de datos."
colors:
  paper: "#fafaf8"
  tile: "#ffffff"
  ink: "#242522"
  ink-soft: "#565850"
  muted: "#6b6c66"
  line: "#deded7"
  line-strong: "#c7cac0"
  tint: "#f2f2ef"
  data: "#68745c"
  data-soft: "#d0d8c3"
  focus: "#0071e3"
  danger: "#a4161a"
  ink-hover: "#3a3b36"
  danger-ink: "#5b0b0e"
  danger-tint: "#fbeeee"
  match-no: "#f3dedb"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.2rem"
    fontWeight: 350
    lineHeight: 1.04
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 450
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 450
    lineHeight: 1.3
  control:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 500
    lineHeight: 1.1
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.1em"
rounded:
  xs: "4px"
  sm: "6px"
  s8: "8px"
  s10: "10px"
  s12: "12px"
  md: "14px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.tile}"
    rounded: "{rounded.pill}"
    padding: "11px 27px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 21px"
    height: "46px"
  card:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-head:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  note:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  data-bar:
    backgroundColor: "{colors.data}"
    textColor: "{colors.tile}"
    rounded: "{rounded.pill}"
    height: "26px"
---

# Design System: 29N

## Overview

**Creative North Star: «El impreso limpio»**

El lenguaje visual está tomado de elecciones29n.com: papel cálido, tinta casi negra, líneas finas de un píxel, Archivo en peso ligero con el interletrado apretado y botones en píldora. Es una herramienta de uso rápido en el móvil, así que todo lo que no es tarea o dato se quita. El diseño no recomienda nada: ningún color, orden ni tamaño sugiere preferencia por un partido.

**Key Characteristics:**
- Fondo de papel cálido y tarjetas blancas con una línea fina, sin sombras.
- Titulares ligeros y grandes, con el interletrado muy apretado.
- Una sola gama para los datos (salvia), sin semáforo.
- Botón principal en píldora de tinta, secundario en píldora con contorno.
- Cuatro pasos siempre visibles como texto: Partidos, Prioridades, Preguntas y Resultados.

## Colors

### Primary
- **Tinta** (`#242522`): texto, botón principal y opción elegida.

### Secondary
- **Salvia de datos** (`#68745c`): barras de afinidad.
- **Salvia suave** (`#d0d8c3`): barras de posiciones documentadas y marca de «coincidís».

### Neutral
- **Papel** (`#fafaf8`): fondo de página.
- **Tile** (`#ffffff`): tarjetas.
- **Tinte** (`#f2f2ef`): notas y celdas de resumen.
- **Línea** (`#deded7`) y **línea fuerte** (`#c7cac0`): separadores y contornos de control.
- **Tinta suave** (`#565850`) y **apagado** (`#6b6c66`): texto secundario.

**The No-Verdict Rule.** Ningún color expresa «mejor» ni «peor». Los porcentajes usan siempre la misma gama de salvia, sin verde y rojo, porque un partido con un 40 % no es «malo».

**The One Ink Rule.** La tinta se reserva para lo que se pulsa y lo que está elegido.

## Typography

**Display Font:** Archivo (variable, 100 a 900, con ancho ajustable)
**Body Font:** Archivo

**Character:** una sans neutra y legible, que gana personalidad solo con el peso ligero y el interletrado apretado de los titulares.

### Hierarchy
- **Display** (350, 2.3 a 4.2 rem, 1.04, -0.045em): título de cada pantalla.
- **Headline** (450, 1.5 rem, 1.12, -0.025em): títulos de pregunta y de partido.
- **Body** (400, 1.0625 a 1.125 rem, 1.55): texto, con un máximo de 66 caracteres de línea.
- **Label** (600, 0.78 rem, mayúsculas, +0.1em): cabecera de cada tarjeta.

## Layout

Una columna de 44 rem como máximo, con cabecera y pie hasta 72 rem. Todo se apila en el móvil y las listas largas pasan a dos columnas desde 48 rem. La acción principal vive en una barra fija abajo, al alcance del pulgar. El ritmo de espacio es de 4, 8, 12, 16, 24, 40 y 64 px.

## Elevation & Depth

Plano. La profundidad la dan la línea fina y el tinte de las notas. Solo la barra fija de abajo usa un fondo translúcido con desenfoque.

## Shapes

Radio de 16 px en tarjetas, 14 px en notas y opciones, 6 px en casillas y píldora completa (999 px) en botones, cápsulas de datos y selector de profundidad.

## Components

### Tarjeta
Tile blanco con línea fina de 1 px. La cabecera lleva el título en mayúsculas pequeñas y apagadas, y una línea inferior.

### Barra de dato
Cápsula cuya anchura es el dato (posiciones documentadas en la selección y afinidad en los resultados). Salvia con texto blanco para la afinidad, y salvia suave con texto de tinta para las posiciones. Con pocos datos, la barra pasa a contorno discontinuo.

### Botones
Principal: píldora de tinta con texto blanco. Secundario: píldora con contorno. Ambos miden al menos 46 px de alto.

### Casillas y segmentos
Casilla de 1.5 rem con contorno de tinta y marca blanca al elegirla. El selector de profundidad es una píldora de tres segmentos que se rellena de tinta.

### Indicador de pasos
Texto pequeño en línea. El paso actual va en tinta, con peso mayor y subrayado.

### Resumen de partido
Cuatro celdas en tinte: posiciones del programa, las que entran en la encuesta, las que coinciden y las que no. Debajo, el detalle por tema con la respuesta de la persona frente al programa y un enlace a la página del PDF.

## Do's and Don'ts

### Do:
- **Do** usar una sola gama de salvia para todo dato.
- **Do** poner siempre la fuente a la vista: cita, página, partido y enlace al programa.
- **Do** probar cada pantalla a 320, 390, 768 y 1280 px.

### Don't:
- **Don't** usar verde y rojo como bueno y malo.
- **Don't** añadir sombras ni degradados.
- **Don't** poner una etiqueta pequeña encima de un titular.
- **Don't** usar colores de partidos como identidad de la interfaz.
