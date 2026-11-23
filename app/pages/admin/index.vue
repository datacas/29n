<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1>{{ $t('admin.dashboard.title') }}</h1>
        <p class="subtitle">Elige por dónde empezar. El flujo habitual va de arriba abajo.</p>
      </div>
    </div>

    <section v-for="group in groups" :key="group.title" class="dash-group">
      <h3>{{ group.title }}</h3>
      <ul class="dash-list">
        <li v-for="item in group.items" :key="item.to">
          <NuxtLink :to="item.to" class="dash-link">
            <span class="dash-name">{{ item.label }}</span>
            <span class="dash-desc">{{ item.desc }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth']
})

const groups = [
  {
    title: 'Contenido',
    items: [
      { to: '/admin/upload', label: 'Subir documento', desc: 'Añade un programa u otra fuente en PDF.' },
      { to: '/admin/sources', label: 'Fuentes', desc: 'Extrae el texto y consulta los pasajes de cada documento.' },
      { to: '/admin/entities', label: 'Entidades', desc: 'Partidos y organizaciones que se comparan.' },
      { to: '/admin/questions', label: 'Preguntas', desc: 'Banco de preguntas por dimensión.' },
      { to: '/admin/positions', label: 'Posiciones', desc: 'Postura de cada entidad en cada pregunta.' }
    ]
  },
  {
    title: 'Revisión',
    items: [
      { to: '/admin/review-questions', label: 'Revisión editorial', desc: 'Aprueba o rechaza posiciones y prepara un release.' },
      { to: '/admin/review', label: 'Propuestas', desc: 'Revisa las afirmaciones extraídas de los documentos.' },
      { to: '/admin/coverage', label: 'Cobertura', desc: 'Matriz de preguntas y entidades con evidencia.' }
    ]
  }
]
</script>

<style scoped>
.dash-group {
  margin-bottom: 2rem;
}

.dash-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-list li {
  display: flex;
}

.dash-link {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 1.125rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink);
  text-decoration: none;
  transition: border-color 0.15s ease-out, box-shadow 0.15s ease-out;
}

.dash-link:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.dash-name {
  font-weight: 600;
}

.dash-desc {
  color: var(--ink-3);
  font-size: 0.875rem;
}
</style>
