export default defineNuxtRouteMiddleware(async () => {
  const admin = useAdminStore()
  if (admin.canAccessAdmin) return navigateTo('/admin')

  try {
    await $fetch('/api/auth/session', { headers: useRequestHeaders(['cookie']) })
    admin.setAuthenticated('cookie')
    return navigateTo('/admin')
  } catch {
    // sin sesión: puede ver el login
  }
})
