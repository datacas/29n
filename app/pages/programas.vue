<template>
  <div class="programas">
    <section class="band">
      <div class="wrap band__inner">
        <h1>Los programas, completos</h1>
        <p>Estos son los PDF que se han leído para esta herramienta. Algunos se han aligerado para que se descarguen rápido: se redujo el tamaño de sus imágenes, y el texto, las páginas y el orden son exactamente los del original. Puedes comprobar cualquier cita en su página.</p>
      </div>
    </section>

    <div class="wrap stack-lg prg__body">
      <ul class="prg__list">
        <li v-for="p in programs" :key="p.slug" class="prg__item">
          <div class="prg__info">
            <h2>{{ p.name }}</h2>
            <p class="small tnum">{{ languageName(p.language) }} · {{ p.pages }} páginas · {{ p.sizeMB }} MB</p>
          </div>
          <div class="prg__actions">
            <a :href="`/programas/${p.file}`" class="btn btn--primary-ghost" download>Descargar PDF</a>
            <a :href="`/programas/${p.file}`" class="btn btn--quiet" target="_blank" rel="noopener">Abrir<span class="visually-hidden"> el programa de {{ p.name }}</span></a>
          </div>
        </li>
      </ul>
      <p class="note">Los programas en catalán, gallego y valenciano se muestran traducidos al castellano en los resultados, y el texto original se conserva. Cada cita de los resultados enlaza con la página exacta de su PDF.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PROGRAMS, languageName } from '~/lib/programs'
const programs = PROGRAMS
useHead({ title: 'Los programas, completos · 29N' })
</script>

<style scoped>
.prg__body { padding-top: var(--space-4); padding-bottom: var(--space-7); }
.prg__list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.prg__item { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-4) 0; border-bottom: 1px solid var(--line); }
.prg__info h2 { font-size: 1.3rem; }
.prg__actions { display: flex; align-items: center; gap: var(--space-2); }
.btn--primary-ghost { border-color: var(--ink); background: var(--ink); color: #fff; }
.btn--primary-ghost:hover { background: #3a3b36; color: #fff; border-color: #3a3b36; }
</style>
