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
          <NuxtLink to="/history"><span class="shell__long">Mis resultados</span><span class="shell__short">Historial</span></NuxtLink>
        </nav>
      </div>
    </header>
    <main id="contenido" class="shell__main">
      <slot />
    </main>
    <footer class="shell__foot">
      <div class="wrap wrap--wide">
        <p>Compara tu opinión con lo que dicen los programas electorales. No recomienda voto.</p>
        <p><NuxtLink to="/programas">Descargar los programas</NuxtLink> · <NuxtLink to="/metodologia">De dónde salen los datos y cómo se calcula</NuxtLink></p>
      </div>
    </footer>
  </div>
</template>

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
@media (max-width: 26rem) { .shell__nav a:first-child { display: none; } }
.shell__foot { border-top: 1px solid var(--line); padding: var(--space-5) 0 var(--space-6); font-size: var(--step--1); color: var(--muted); }
.shell__foot p + p { margin-top: var(--space-2); }
.shell__foot a { color: var(--ink-soft); }
</style>
