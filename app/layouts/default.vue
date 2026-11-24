<template>
  <div class="shell">
    <a href="#contenido" class="skip">Saltar al contenido</a>
    <header class="shell__bar">
      <div class="wrap wrap--wide shell__row">
        <NuxtLink to="/" class="shell__brand" aria-label="29N, inicio">
          <span class="shell__name">29N</span>
        </NuxtLink>
        <nav class="shell__nav" aria-label="Principal">
          <NuxtLink to="/programas">Programas</NuxtLink>
          <NuxtLink to="/metodologia">Cómo funciona</NuxtLink>
          <NuxtLink v-if="hasHistory" to="/historia" class="shell__hist">Historia</NuxtLink>
          <NuxtLink v-if="statsVisible" to="/estadisticas" class="shell__stats">Estadísticas</NuxtLink>
          <NuxtLink to="/history"><span class="shell__long">Mis resultados</span><span class="shell__short">Resultados</span></NuxtLink>
        </nav>
      </div>
    </header>
    <main id="contenido" class="shell__main">
      <slot />
    </main>
    <footer class="shell__foot">
      <div class="wrap wrap--wide">
        <p>Compara tu opinión con lo que dicen los programas electorales. No recomienda voto.</p>
        <p><NuxtLink to="/programas">Descargar los programas</NuxtLink> · <NuxtLink to="/metodologia">De dónde salen los datos y cómo se calcula</NuxtLink><template v-if="statsVisible"> · <NuxtLink to="/estadisticas">Estadísticas</NuxtLink></template></p>
        <p>¿Te ha servido? <KofiButton quiet>Invítame a un café en Ko-fi</KofiButton></p>
        <PwaInstall />
        <p>
          <a class="shell__gh" href="https://github.com/datacas/29n" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
            Código abierto en GitHub
          </a>
        </p>
      </div>
    </footer>
    <PwaToast />
  </div>
</template>

<script setup lang="ts">
const statsVisible = useStatsVisible()
import surveysJson from '~/data/surveys.json'
// Las encuestas históricas van aparte, en /historia: así no se confunden con la del 29N en la portada
const hasHistory = (surveysJson as any[]).some((s) => s.kind === 'historical')
</script>

<style scoped>
.shell { min-height: 100dvh; display: flex; flex-direction: column; }
.skip { position: absolute; left: -999px; top: 0; z-index: 20; background: var(--ink); color: #fff; padding: 0.75rem 1rem; font-weight: 600; }
.skip:focus { left: 0; }
.shell__bar { border-bottom: 1px solid var(--line); background: var(--paper); }
.shell__row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding-top: 0.2rem; padding-bottom: 0.2rem; }
.shell__brand { display: inline-flex; align-items: center; font-weight: 700; font-size: 1.35rem; letter-spacing: -0.04em; color: var(--ink); text-decoration: none; min-height: 2.9rem; }
.shell__nav { display: flex; gap: var(--space-3); }
.shell__nav a { color: var(--muted); text-decoration: none; font-size: 0.88rem; font-weight: 500; min-height: 2.9rem; display: inline-flex; align-items: center; white-space: nowrap; }
.shell__nav a:hover, .shell__nav a.router-link-exact-active { color: var(--ink); }
.shell__short { display: inline; }
.shell__long { display: none; }
@media (min-width: 30rem) { .shell__short { display: none; } .shell__long { display: inline; } .shell__nav { gap: var(--space-5); } }
.shell__main { flex: 1; }
@media (max-width: 40rem) { .shell__stats { display: none !important; } }
@media (max-width: 26rem) { .shell__nav a:first-child { display: none; } }
.shell__foot { border-top: 1px solid var(--line); padding: var(--space-5) 0 var(--space-6); font-size: var(--step--1); color: var(--muted); }
.shell__foot p + p { margin-top: var(--space-2); }
.shell__foot a { color: var(--ink-soft); }
.shell__gh { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.75rem; }
.shell__gh svg { flex: none; }
</style>
