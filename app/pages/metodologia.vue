<template>
  <div>
  <section class="band on-band">
    <div class="wrap band__inner">
      <h1>Cómo funciona esta herramienta</h1>
      <p>Compara lo que piensas con lo que dicen por escrito los programas de las elecciones generales del 29 de noviembre de 2026. Aquí tienes de dónde salen los datos, cómo se calcula el porcentaje, los <a href="#estadistica">métodos estadísticos</a> que usamos y qué límites tiene.</p>
    </div>
  </section>
  <article class="metodologia wrap">

    <h2>Qué mide el porcentaje</h2>
    <p>
      Mide cuánto se parece tu opinión a la <strong>posición escrita en el programa</strong> de cada partido. No predice lo que hará un partido si gobierna
      ni sustituye a leer los programas. Un 100 % es coincidir del todo y un 0 % es estar en polos opuestos.
    </p>

    <h2>De dónde salen los datos</h2>
    <ul>
      <li>Solo se usan los <strong>programas electorales</strong> que cada partido ha publicado. No se usan declaraciones, entrevistas ni noticias.</li>
      <li>Cada posición va unida a una <strong>cita literal del programa, con su página</strong>. La ves pulsando «Ver evidencia» en los resultados.</li>
      <li>Los programas en gallego, catalán o valenciano se muestran traducidos al castellano, y se conserva el texto original.</li>
      <li>Puedes <NuxtLink to="/programas">descargar los programas completos</NuxtLink> y comprobar cada cita: en los resultados, cada una enlaza con su página del PDF.</li>
      <li>Si un programa no dice nada sobre un tema, <strong>no se inventa una posición</strong>. Ese tema no cuenta para ese partido.</li>
    </ul>

    <h2 id="codificacion">Cómo se han codificado las posiciones</h2>
    <p>
      Las posiciones se han codificado con ayuda de <strong>inteligencia artificial</strong>: una herramienta encontró los fragmentos de cada programa que hablan de cada pregunta
      y se asignó el valor de cada posición, de −2 (se opone con claridad) a +2 (apoya con claridad), con revisiones asistidas por IA desde un panel de administración.
      Cuando una cita era dudosa, o no respondía a la pregunta, se descartó.
      Una comprobación automática verifica además que cada cita existe tal cual en el PDF original.
    </p>
    <p>
      <strong>Esto no ha sido validado por personas independientes</strong> y no es infalible. Si encuentras una posición que te parece mal asignada, revisa la cita con «Ver evidencia» y tenla en cuenta al leer el resultado.
      Más abajo explicamos qué hemos comprobado, con qué métodos estadísticos y qué no podemos afirmar.
    </p>

    <h2 id="calculo">Cómo se calcula</h2>
    <ol>
      <li>Contestas cada pregunta de −2 (totalmente en desacuerdo) a +2 (totalmente de acuerdo). Si no tienes opinión, marcas «No sé» y esa pregunta no cuenta, igual que las que omites.</li>
      <li>Para cada partido con posición en esa pregunta, se mide la distancia entre tu respuesta y la suya. Cuanto menor, mayor el acuerdo.</li>
      <li>El porcentaje de cada partido es la media de esos acuerdos. Las preguntas donde el partido no tiene posición no suman ni restan.</li>
      <li>Los temas que más te importan pesan más. Lo decides en las comparaciones de prioridades y, si quieres, marcando la importancia en cada pregunta.</li>
    </ol>
    <details>
      <summary>La fórmula exacta y su estadística</summary>
      <p>
        <strong>Acuerdo en una pregunta:</strong> 1 − |tu respuesta − la posición del partido| ÷ 4. Con respuestas entre −2 y +2, coincidir da 1 (100 %), estar a dos puntos da 0,5 y estar en polos opuestos da 0.
      </p>
      <p>
        <strong>Por tema:</strong> media de esos acuerdos ponderada por la importancia que das a cada pregunta, solo con las preguntas donde ese partido tiene posición.
        <strong>Global:</strong> media ponderada de los temas evaluables, con los pesos de tus comparaciones de prioridades y renormalizados cuando un tema no se puede evaluar.
        Es una media ponderada de distancias, no un modelo probabilístico: no hay estimaciones con intervalos de confianza para tu resultado individual.
      </p>
      <p>
        Sobre la <em>fiabilidad de los datos</em> (cómo de consistente es la codificación de las posiciones, qué muestra se necesita para validarla, cuánto cambia el resultado al quitar una pregunta) usamos acuerdo entre codificadores (alfa de Krippendorff, kappa ponderado, AC1/AC2 de Gwet), intervalos bootstrap y de Wilson, estimadores estratificados con pesos de diseño y tamaño efectivo de muestra de Kish. Se explican abajo, en <a href="#estadistica">Métodos estadísticos</a>.
      </p>
    </details>
    <p>
      Los partidos con muy pocas posiciones documentadas aparecen al final con la etiqueta «Pocos datos», aunque su porcentaje sea alto,
      porque con tan pocas preguntas el resultado no es fiable.
    </p>
    <p>
      <strong>Diferencia pequeña.</strong> Si los primeros partidos están a menos de 3 puntos del que encabeza, la pantalla de resultados no los ordena como si se distinguieran: los marca como «diferencia pequeña». El grupo se mide desde el primero, sin encadenar, y los partidos con «Pocos datos» no entran. El umbral de 3 puntos se estimó con usuarios sintéticos y pesos iguales (versión 2.2.1): con una diferencia menor, quitar una sola pregunta cambia el primer partido en más del 12 % de los casos; entre 3 y 5 puntos, en el 7 %; por encima de 8, en el 2 %. No se ha comprobado con usuarios reales.
    </p>

    <h2>Qué preguntas te salen</h2>
    <ul>
      <li>El número cambia según los partidos que elijas y la profundidad (rápida, normal, profunda o total, que incluye todas las preguntas de los partidos elegidos).</li>
      <li>Las preguntas regionales, y las que solo trata un partido, salen únicamente si eliges a ese partido, y se suman al total.</li>
      <li>Las preguntas se redactan sin añadir el objetivo que se busca. El cuestionario mezcla preguntas donde el «sí» favorece a unos partidos y preguntas donde favorece a otros, para que decir «sí» a todo no beneficie a un lado.</li>
      <li>Los partidos se muestran en orden alfabético, no por tamaño ni por cercanía a ti.</li>
    </ul>

    <h2>Qué debes tener en cuenta</h2>
    <ul>
      <li><strong>Los programas hablan sobre todo de lo que quieren hacer,</strong> y muy poco de lo que rechazan. Por eso, contestar «de acuerdo» a todo te acerca a los partidos con más propuestas de gasto o regulación. Responde con tu opinión real.</li>
      <li>Un partido con un programa más corto o más general tendrá menos posiciones y su porcentaje será menos fiable.</li>
      <li>Que un partido no tenga posición en una pregunta no significa que esté a favor, en contra ni que sea neutral. Significa que el programa no lo dice.</li>
    </ul>

    <h2 id="calidad">Cómo comprobamos la calidad de las preguntas y de los datos</h2>
    <p>
      Estamos revisando el cuestionario de forma sistemática. Todo lo que sigue lo hacen herramientas automáticas y modelos de inteligencia artificial,
      con controles para detectar sus errores; <strong>no hay validación humana independiente</strong>. Cada proceso indica su estado.
    </p>
    <div class="estado">
      <table>
        <thead><tr><th>Proceso</th><th>Qué comprueba</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td>Cita literal</td><td>Que cada cita existe tal cual en el PDF del programa, con su página</td><td>Hecho; se aplica a todas las citas</td></tr>
          <tr><td>Primera auditoría de preguntas</td><td>Preguntas con doble contenido, objeto compuesto, sin dirección clara o con presuposiciones</td><td>Hecha (una sola IA)</td></tr>
          <tr><td>Segunda auditoría independiente</td><td>Lo mismo, con modelos de varias familias que no se ven entre sí, con controles positivos y negativos</td><td>Hecha con varios modelos. Con un criterio estricto y calibrado, un modelo (GPT-6 Luna) acierta los 6 controles positivos y no marca ninguno de los 6 negativos, y señala 15 de 146 preguntas (14 coinciden con la primera auditoría); detecta poco (no marca el caso de sindicatos y patronal). Los modelos gratuitos con criterio abierto marcan casi todo y no sirven</td></tr>
          <tr><td>Poder discriminante</td><td>Qué preguntas distinguen a los partidos y cuáles no</td><td>Hecho</td></tr>
          <tr><td>Influencia en el ranking</td><td>Cuánto cambia el resultado al quitar una pregunta</td><td>Hecho (usuarios sintéticos)</td></tr>
          <tr><td>Legibilidad y estructura</td><td>Longitud, negaciones, conjunciones, texto explicativo</td><td>Hecho</td></tr>
          <tr><td>Neutralidad y encuadre</td><td>Qué posiciones favorece responder «de acuerdo» y si hay términos cargados</td><td>Hecho en la misma ejecución; solo orientativo</td></tr>
          <tr><td>Fiabilidad entre codificadores</td><td>Acuerdo entre modelos de IA al codificar posiciones, con intervalos de confianza</td><td>Hecho en una muestra pequeña; ver abajo</td></tr>
          <tr><td>Corrección de preguntas con doble contenido</td><td>Dividir o reformular las preguntas señaladas</td><td>Hecha en las versiones 2.2.0 y 2.2.1: 31 preguntas se dividen en preguntas de una sola proposición (173 preguntas en total). En la mitad de los casos el programa solo hablaba de una de las dos cosas que preguntaba la pregunta. Otras cinco señaladas se revisaron una por una y se mantienen porque tratan un solo objeto</td></tr>
        </tbody>
      </table>
    </div>

    <h3>Lo que hemos encontrado hasta ahora</h3>
    <ul>
      <li><strong>Cobertura.</strong> De las 3.287 combinaciones entre 173 preguntas y 19 partidos (versión 2.2.1), <strong>2.243 (68 %) no tienen posición</strong> porque el programa no dice nada. Esas celdas no cuentan, y no significan «a favor», «en contra» ni «neutral». Por eso cada porcentaje se calcula sobre un subconjunto distinto de tus respuestas, y la pantalla de resultados indica junto a cada uno en cuántas se basa («basado en 23 de tus 60 respuestas»).</li>
      <li><strong>Sesgo hacia el «sí».</strong> De las posiciones registradas, el <strong>85 % son positivas</strong> y solo el 15 % negativas, porque los programas hablan sobre todo de lo que quieren hacer. Por eso contestar «de acuerdo» a todo favorece a los partidos con más propuestas.</li>
      <li><strong>Preguntas con doble contenido.</strong> La primera auditoría señala <strong>36 de las 146 preguntas (25 %)</strong> como probables dobles (dos propuestas en una), 20 más con objeto compuesto, 3 sin dirección clara y 10 con presuposiciones. En la versión 2.2.1 se han dividido 31 de ellas en preguntas de una sola proposición, y otras cinco señaladas se han revisado y se mantienen. Las cifras de esta lista son de la primera auditoría, sobre la versión 2.1.2, anterior a la corrección.</li>
      <li><strong>Preguntas que apenas distinguen.</strong> En 62 preguntas el 90 % o más de los partidos con posición comparte el mismo sentido, y 19 preguntas tienen posición de menos de dos partidos (comparan poco o nada). Cifras de la versión 2.2.1.</li>
      <li><strong>Peso de cada pregunta.</strong> Con 300 usuarios sintéticos y la versión 2.2.1, quitar una sola pregunta cambia de media el orden de los partidos muy poco (correlación τ de Kendall mediana 0,95) y cambia el partido en primer lugar en el 6 % de los casos (mediana por pregunta; máximo 24 % para la pregunta más influyente).</li>
      <li><strong>Legibilidad.</strong> Las preguntas tienen una mediana de 10 palabras, ninguna supera las 28 ni tiene doble negación, todas llevan texto explicativo y 32 contienen una conjunción (y, o, ni). Algo más de una de cada seis (28) tiene un índice de lectura Fernández-Huerta por debajo de 40 (difícil).</li>
      <li><strong>Estabilidad del ranking.</strong> Con usuarios sintéticos y cambios simulados del 5 % al 20 % de las posiciones, el partido en primer lugar se mantiene entre el 52 % y el 89 % de los casos según el tipo de usuario y de cambio (versión 2.2.1, 400 usuarios por escenario). Por eso el resultado es una <strong>orientación</strong>, no un veredicto, y los huecos pequeños entre partidos deben leerse con prudencia.</li>
    </ul>

    <h2 id="estadistica">Métodos estadísticos</h2>
    <details>
      <summary>Cómo medimos la fiabilidad de la codificación</summary>
      <p>
        Cada posición se codifica en una <strong>clase documental</strong> (apoya, se opone, neutral explícita, no mencionado, ambigua) y, si procede, una <strong>intensidad</strong> ordinal de −2 a +2,
        siguiendo un manual de codificación fijo y versionado. Los fallos técnicos (error, tiempo, documento no disponible) se registran aparte y nunca se cuentan como «no mencionado».
        Cada modelo codifica sin ver a los demás, y se descartan las respuestas servidas por un modelo distinto del pedido.
      </p>
      <ul>
        <li><strong>Alfa de Krippendorff.</strong> Mide el acuerdo entre varios codificadores corrigiendo el azar: nominal para la clase y <strong>ordinal</strong> para la intensidad (una discrepancia de un punto pesa menos que una de tres). 1 es acuerdo total y 0 el que daría el azar.</li>
        <li><strong>Kappa ponderado (cuadrático)</strong> para pares de codificadores y <strong>AC1 / AC2 de Gwet</strong>, más robustos cuando casi todas las respuestas caen en pocas categorías.</li>
        <li><strong>Acuerdo exacto, desviación absoluta media y discrepancias de signo</strong> (apoya frente a se opone), que son las más graves.</li>
        <li><strong>Intervalos de confianza al 95 %</strong> por remuestreo (bootstrap de 1.000 réplicas por celdas) para los coeficientes de acuerdo, e intervalos de Wilson para las proporciones. Las implementaciones se han contrastado con librerías externas independientes.</li>
        <li><strong>Mínimo de datos.</strong> Con menos de 10 pares de respuestas, una métrica se marca como «no evaluable» y no se interpreta.</li>
      </ul>
      <p>
        <strong>Resultado en una muestra pequeña</strong> (40 celdas elegidas a propósito para cubrir distintos casos, no representativas): entre tres modelos de familias distintas,
        alfa nominal de la clase <strong>0,91</strong> (IC 95 %: 0,82–1,00) y alfa ordinal de la intensidad <strong>0,67</strong> (IC 95 %: 0,39–0,82). Los kappa por pares de la clase van de 0,87 a 0,95.
        Es decir: los modelos coinciden mucho en <em>qué</em> dice el programa y bastante menos en <em>cuánta</em> intensidad tiene, que es donde hay que ser más cuidadoso. Con siete modelos (algunos parciales) los valores son 0,90 y 0,60.
        Esta muestra no permite generalizar a todo el cuestionario.
      </p>
    </details>
    <details>
      <summary>Cómo se diseña una muestra para validar</summary>
      <p>
        Para estimar cuánto acierta el sistema en <em>todo</em> el cuestionario, y no solo en los casos fáciles, se usa un <strong>muestreo estratificado</strong>:
        las celdas se agrupan en estratos (apoya con fuerza, apoya con matices, en contra, sin posición registrada…), se eligen de forma sistemática y con semilla fija dentro de cada estrato,
        y cada celda lleva su <strong>probabilidad de inclusión</strong> y su <strong>peso</strong> (el inverso de esa probabilidad). Las estimaciones usan esos pesos y la corrección de población finita,
        y se informa del <strong>tamaño efectivo</strong> de Kish, que descuenta lo que se pierde por tener pesos desiguales. Los casos elegidos a propósito (por ejemplo los dudosos) se analizan <strong>aparte</strong> y nunca se mezclan con la muestra representativa.
        Una muestra de 105 celdas permite estimar una proporción con una precisión de unos ±6 a ±9 puntos; por estrato solo se puede describir.
      </p>
      <p>
        Se ha hecho una lectura independiente de una muestra así con inteligencia artificial; sus resultados están en revisión y los publicaremos cuando estén contrastados.
      </p>
    </details>
    <details>
      <summary>Cómo medimos la sensibilidad y el peso de cada pregunta</summary>
      <p>
        Se simulan <strong>usuarios sintéticos</strong> con la misma fórmula que usa la herramienta (proximidad = 1 − |tu respuesta − posición| / 4, media por dimensión y entre dimensiones) con una semilla fija.
        Para el peso de cada pregunta se calcula el ranking con y sin ella (τ de Kendall entre ambos órdenes y frecuencia con que cambia el primer puesto). Para la estabilidad se perturba entre el 5 % y el 20 % de las posiciones.
        Los usuarios sintéticos ilustran cómo se comporta el modelo; no miden a votantes reales.
      </p>
    </details>

    <h2 id="limites">Qué no podemos afirmar</h2>
    <ul>
      <li><strong>No hay validación humana independiente.</strong> La codificación y las revisiones son asistidas por inteligencia artificial. El acuerdo entre modelos mide consistencia, no verdad.</li>
      <li><strong>Los modelos pueden compartir errores.</strong> Que varios coincidan no garantiza que acierten: por eso hay controles, comprobación literal de las citas y auditorías con varias familias de modelos.</li>
      <li><strong>No sabemos aún cómo entienden las preguntas las personas.</strong> Las pruebas de comprensión son sintéticas y no sustituyen a las personas reales.</li>
      <li><strong>Las muestras pequeñas no se generalizan</strong> y las estimaciones llevan su intervalo de confianza.</li>
      <li><strong>El cuestionario está en mejora.</strong> Quedan preguntas señaladas por corregir; los cambios se publican en versiones nuevas con su registro.</li>
    </ul>


    <h2 id="versiones">Versiones del cuestionario</h2>
    <ul>
      <li><strong>2.2.1 (26 de noviembre de 2026, vigente).</strong> Dos preguntas más con varios objetos y sin dirección (impuestos de la vivienda y legislación cultural) se dividen en preguntas con dirección explícita, y se incorporan 10 posiciones nuevas de mitades de preguntas ya divididas, adjudicadas por IA con su cita literal y sin validación humana independiente. Los bloqueos de publicación comprueban ahora que cada cita exista en el PDF original. La pantalla de resultados muestra en cuántas de tus respuestas se basa cada porcentaje y agrupa como «diferencia pequeña» a los primeros partidos que están a menos de 3 puntos. Las estadísticas de uso empiezan de cero para esta versión.</li>
      <li><strong>2.2.0 (26 de noviembre de 2026).</strong> 29 preguntas con doble contenido se dividen en 59 de una sola proposición (172 preguntas, 1.051 posiciones). Una revisión asistida por IA añade 15 posiciones, corrige 8 y retira 2, siempre con su cita literal; sin validación humana independiente. Las estadísticas de uso empiezan de cero para esta versión.</li>
      <li><strong>2.1.2 (24 de noviembre de 2026).</strong> 146 preguntas, 1.048 posiciones.</li>
    </ul>

    <h2>Código y datos abiertos</h2>
    <p>
      El código tiene licencia MIT y los datos (preguntas, posiciones y guías) tienen licencia CC BY 4.0: puedes copiarlos y usarlos
      como quieras, <strong>citando el original</strong>. Los programas electorales son de cada partido.
      Todo está en <a href="https://github.com/datacas/29n" target="_blank" rel="noopener noreferrer">GitHub</a>.
    </p>

    <h2>Tus datos</h2>
    <ul>
      <li>Tus respuestas y tus resultados <strong>se guardan en tu navegador</strong>. Para las estadísticas, el servidor los recibe una vez, sin ningún identificador, y solo los usa para sumar contadores: no guarda ningún registro individual (abajo).</li>
      <li>Contamos de forma anónima cuántas encuestas se empiezan y se terminan, con la profundidad y los partidos elegidos. No guardamos tu IP ni ningún identificador, y no se envía nada si tu navegador tiene activado «No rastrear» o el control global de privacidad.</li>
      <li>Al ver tu resultado, tus respuestas y tu afinidad con cada programa se envían una vez para <strong>sumar de forma anónima</strong> a las estadísticas. No guardamos una ficha por persona: cada respuesta solo añade 1 a un contador (por ejemplo, «pregunta 12, de acuerdo»), sin IP ni ningún identificador, así que nadie, tampoco nosotros, puede saber qué respondiste. Si tu navegador tiene activado «No rastrear» o el control global de privacidad, no se envía nada. Las estadísticas públicas se abren cuando al menos 10 personas han terminado la encuesta, y ninguna cifra se publica si se apoya en menos de 10 personas.</li>
      <li>Contamos las visitas a la web con Vercel Web Analytics, que no usa cookies ni te identifica. Solo suma páginas vistas. No se carga si tienes activado «No rastrear» o el control global de privacidad.</li>
    </ul>

    <p class="back"><NuxtLink to="/">Volver al inicio</NuxtLink></p>
  </article>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Cómo funciona · 29N' })
</script>

<style scoped>
.metodologia { padding-top: var(--space-5); padding-bottom: var(--space-7); line-height: 1.6; }
.metodologia h2 { font-size: var(--step-2); margin: var(--space-6) 0 var(--space-2); }
.metodologia ul, .metodologia ol { padding-left: 1.3rem; }
.metodologia li { margin-bottom: 0.5rem; max-width: 68ch; }
.back { margin-top: var(--space-6); }
.metodologia h3 { font-size: var(--step-1); margin: var(--space-4) 0 var(--space-2); }
.metodologia details { margin: var(--space-3) 0; padding: var(--space-3); border: 1px solid var(--line); border-radius: 10px; }
.metodologia summary { cursor: pointer; font-weight: 600; }
.estado { overflow-x: auto; margin: var(--space-3) 0; }
.estado table { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
.estado th, .estado td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
</style>
