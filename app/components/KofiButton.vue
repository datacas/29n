<template>
  <a v-if="url" class="kofi" :class="{ 'kofi--quiet': quiet }" :href="url" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 6h14v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V6Zm14 1.5h1.5a2.5 2.5 0 0 1 0 5H17v-5ZM2 20h17v1.5H2V20Z"/></svg>
    <span><slot>Invítame a un café</slot></span>
  </a>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ quiet?: boolean }>(), { quiet: false })
const url = useRuntimeConfig().public.kofiUrl as string
</script>

<style scoped>
.kofi { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.75rem; padding: 0 1rem; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 600; text-decoration: none; }
.kofi:hover { filter: brightness(0.95); }
.kofi--quiet { background: transparent; padding: 0; color: var(--ink-soft); font-weight: 400; text-decoration: underline; }
.kofi svg { flex: none; }
</style>
