<template>
  <div class="home">
    <section class="band on-band">
      <div class="wrap band__inner home__intro">
        <h1>¿Con qué programa coincides más?</h1>
        <p>Contesta unas preguntas y compara tu opinión con lo que dicen por escrito los programas electorales. Cada porcentaje se apoya en una cita del programa, con su página.</p>
        <NuxtLink v-if="current.length === 1" :to="`/survey/${current[0].release_id}/start`" class="btn-primary home__cta">{{ $t('survey.detail.start') }}</NuxtLink>
      </div>
    </section>

    <div class="wrap stack-lg home__body">
      <p v-if="!current.length" class="note no-surveys" role="status">{{ $t('survey.catalog.noSurveys') }}</p>

      <ul v-else-if="current.length > 1" class="survey-list">
        <li v-for="survey in current" :key="survey.release_id">
          <NuxtLink :to="`/survey/${survey.release_id}/start`" class="survey-card label">
            <span class="label__head"><h2>{{ survey.title }}</h2><span class="meta">v{{ survey.release_version }}</span></span>
            <span class="label__body">{{ survey.description }}</span>
          </NuxtLink>
        </li>
      </ul>

      <section class="label" aria-labelledby="h-como">
        <div class="label__head"><h2 id="h-como">Cómo funciona</h2><span class="meta">unos 8 minutos</span></div>
        <ol class="home__steps">
          <li><b>Elige los partidos</b><span>Los que quieras comparar. Salen en orden alfabético.</span></li>
          <li><b>Di qué temas te importan más</b><span>Con unas pocas comparaciones. Así tu resultado pesa lo que tú priorizas.</span></li>
          <li><b>Contesta las preguntas</b><span>Cada una trae una explicación por si el tema te suena lejos.</span></li>
          <li><b>Mira de dónde sale cada porcentaje</b><span>Con la cita literal del programa y su página.</span></li>
        </ol>
        <p class="meta">El porcentaje es la media, ponderada por tus prioridades, de cuánto se acerca tu respuesta a la posición escrita de cada partido. <NuxtLink to="/metodologia#calculo">Fórmula y métodos estadísticos</NuxtLink>.</p>
      </section>

      <section class="label home__share" aria-labelledby="h-share">
        <div class="label__head"><h2 id="h-share">Compártelo</h2></div>
        <div class="label__body"><ShareButtons label="Envíaselo a quien quieras" text="29N: compara tu opinión con los programas electorales del 29 de noviembre. Cada porcentaje se apoya en una cita del programa, con su página." /></div>
      </section>

      <div class="note"><strong>No recomienda voto.</strong> Compara tu opinión con lo que dicen los programas, no con lo que luego haga cada partido. Tus respuestas se quedan en tu navegador. <NuxtLink to="/metodologia">Cómo se calcula y de dónde salen los datos</NuxtLink>.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// La lista de encuestas publicadas se genera con `npm run data:export` y viaja dentro del código
import surveysJson from '~/data/surveys.json'
const surveys = ref<any[]>(surveysJson as any[])
// La encuesta histórica tiene su propia página (/historia, enlazada en la barra superior): aquí solo la del 29N
const current = computed(() => surveys.value.filter((s: any) => s.kind !== 'historical'))

useHead({ title: '29N · ¿Con qué programa coincides más?' })
</script>

<style scoped>
.home__intro { padding-top: var(--space-5); padding-bottom: var(--space-6); }
.home__cta { margin-top: var(--space-5); width: 100%; max-width: 22rem; }
.home__body { padding-top: var(--space-6); padding-bottom: var(--space-7); }
.survey-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
.survey-card { display: block; text-decoration: none; color: inherit; }
.survey-card:hover { background: var(--tint); }
.home__steps { list-style: none; margin: 0; padding: 0; counter-reset: paso; }
.home__steps li { counter-increment: paso; display: grid; grid-template-columns: 2.6rem 1fr; column-gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); }
.home__steps li:last-child { border-bottom: 0; }
.home__steps li::before { content: counter(paso); grid-row: span 2; align-self: start; display: grid; place-content: center; width: 2rem; height: 2rem; border-radius: 50%; border: 1px solid var(--ink); font-size: 0.95rem; font-weight: 600; }
.home__share { margin-top: var(--space-7); }
.home__steps b { font-size: 1.08rem; font-weight: 500; }
.home__steps span { color: var(--ink-soft); }
</style>
