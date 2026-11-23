<template>
  <div>
  <section class="band on-band">
    <div class="wrap band__inner">
      <h1>Cómo funciona esta herramienta</h1>
      <p>Compara lo que piensas con lo que dicen por escrito los programas de las elecciones generales del 29 de noviembre de 2026. Aquí tienes de dónde salen los datos, cómo se calcula el porcentaje y qué límites tiene.</p>
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

    <h2>Cómo se han codificado las posiciones</h2>
    <p>
      Una herramienta de inteligencia artificial ayudó a encontrar los fragmentos de cada programa que hablan de cada pregunta.
      Después, el equipo editorial leyó las citas y decidió el valor de cada posición, de −2 (se opone con claridad) a +2 (apoya con claridad).
      Cuando una cita era dudosa, o no respondía a la pregunta, se descartó.
      Una comprobación automática verifica además que cada cita existe tal cual en el PDF original.
    </p>
    <p>
      Esto no es infalible. Si encuentras una posición que te parece mal asignada, revisa la cita con «Ver evidencia» y tenla en cuenta al leer el resultado.
    </p>

    <h2>Cómo se calcula</h2>
    <ol>
      <li>Contestas cada pregunta de −2 (totalmente en desacuerdo) a +2 (totalmente de acuerdo). Si no tienes opinión, marcas «No sé» y esa pregunta no cuenta, igual que las que omites.</li>
      <li>Para cada partido con posición en esa pregunta, se mide la distancia entre tu respuesta y la suya. Cuanto menor, mayor el acuerdo.</li>
      <li>El porcentaje de cada partido es la media de esos acuerdos. Las preguntas donde el partido no tiene posición no suman ni restan.</li>
      <li>Los temas que más te importan pesan más. Lo decides en las comparaciones de prioridades y, si quieres, marcando la importancia en cada pregunta.</li>
    </ol>
    <p>
      Los partidos con muy pocas posiciones documentadas aparecen al final con la etiqueta «Pocos datos», aunque su porcentaje sea alto,
      porque con tan pocas preguntas el resultado no es fiable.
    </p>

    <h2>Qué preguntas te salen</h2>
    <ul>
      <li>El número cambia según los partidos que elijas y la profundidad (rápida, normal o profunda).</li>
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

    <h2>Código y datos abiertos</h2>
    <p>
      El código tiene licencia MIT y los datos (preguntas, posiciones y guías) tienen licencia CC BY 4.0: puedes copiarlos y usarlos
      como quieras, <strong>citando el original</strong>. Los programas electorales son de cada partido.
      Todo está en <a href="https://github.com/datacas/29n" target="_blank" rel="noopener noreferrer">GitHub</a>.
    </p>

    <h2>Tus datos</h2>
    <ul>
      <li>Tus respuestas y tus resultados <strong>se guardan solo en tu navegador</strong>. Al servidor solo llegan recuentos anónimos (abajo).</li>
      <li>Contamos de forma anónima cuántas encuestas se empiezan y se terminan, con la profundidad y los partidos elegidos. No guardamos tu IP, tus respuestas ni tus resultados, y respetamos la opción «No rastrear» del navegador.</li>
      <li>Al ver tu resultado, tus respuestas y tu afinidad con cada programa <strong>suman de forma anónima</strong> a las estadísticas. No guardamos una ficha por persona: cada respuesta solo añade 1 a un contador (por ejemplo, «pregunta 12, de acuerdo»), sin IP ni ningún identificador, así que nadie, tampoco nosotros, puede saber qué respondiste. Si tu navegador tiene activado «No rastrear», no se envía nada. Las estadísticas públicas se abren cuando al menos 10 personas han terminado la encuesta, y ninguna cifra se publica si se apoya en menos de 10 personas.</li>
      <li>Contamos las visitas a la web con Vercel Web Analytics, que no usa cookies ni te identifica. Solo suma páginas vistas. No se carga si tienes activado «No rastrear».</li>
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
</style>
