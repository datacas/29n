<template>
  <div class="admin-shell">
    <aside class="admin-sidebar" :class="{ open: menuOpen }">
      <NuxtLink to="/admin" class="admin-brand">
        <span class="admin-brand-mark" aria-hidden="true">A</span>
        <span>Afinidad <small>Administración</small></span>
      </NuxtLink>

      <nav class="admin-menu" aria-label="Administración">
        <div v-for="group in groups" :key="group.label" class="admin-menu-group">
          <p class="admin-menu-label">{{ group.label }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="admin-menu-link"
            @click="menuOpen = false"
          >
            {{ item.label }}
          </NuxtLink>
        </div>
      </nav>

      <div class="admin-sidebar-foot">
        <NuxtLink to="/" class="admin-menu-link">Ver sitio público</NuxtLink>
        <button type="button" class="admin-logout" :disabled="loggingOut" @click="logout">
          {{ loggingOut ? 'Cerrando…' : 'Cerrar sesión' }}
        </button>
      </div>
    </aside>

    <div class="admin-body">
      <header class="admin-topbar">
        <button
          type="button"
          class="admin-menu-toggle"
          :aria-expanded="menuOpen"
          aria-label="Abrir menú"
          @click="menuOpen = !menuOpen"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <span class="admin-topbar-title">Afinidad · Administración</span>
      </header>
      <main class="admin-content">
        <slot />
      </main>
    </div>
    <div v-if="menuOpen" class="admin-scrim" @click="menuOpen = false" />
  </div>
</template>

<script setup lang="ts">
const groups = [
  {
    label: 'Inicio',
    items: [{ to: '/admin', label: 'Resumen' }, { to: '/admin/stats', label: 'Estadísticas de uso' }]
  },
  {
    label: 'Contenido',
    items: [
      { to: '/admin/sources', label: 'Fuentes' },
      { to: '/admin/upload', label: 'Subir documento' },
      { to: '/admin/entities', label: 'Entidades' },
      { to: '/admin/questions', label: 'Preguntas' },
      { to: '/admin/positions', label: 'Posiciones' }
    ]
  },
  {
    label: 'Revisión',
    items: [
      { to: '/admin/review-questions', label: 'Revisión editorial' },
      { to: '/admin/position-values', label: 'Asignar posturas' },
      { to: '/admin/jev-labeling', label: 'Etiquetado (SPIKE-12)' },
      { to: '/admin/evaluacion', label: 'Evaluación humana' },
      { to: '/admin/adjudicacion', label: 'Adjudicación (sombra)' },
      { to: '/admin/jev-triage', label: 'Triaje Jev' },
      { to: '/admin/review', label: 'Propuestas' },
      { to: '/admin/coverage', label: 'Cobertura' }
    ]
  }
]

const menuOpen = ref(false)
const loggingOut = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuOpen.value = false })

async function logout() {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // aunque falle, se descarta la sesión local
  } finally {
    useAdminStore().logout()
    loggingOut.value = false
    await navigateTo('/admin/login')
  }
}
</script>
