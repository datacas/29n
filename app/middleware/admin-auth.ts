export default defineNuxtRouteMiddleware(async () => {
  const admin = useAdminStore()
  if (admin.canAccessAdmin) return

  try {
    await $fetch('/api/auth/session', { headers: useRequestHeaders(['cookie']) })
    admin.setAuthenticated('cookie')
  } catch {
    admin.logout()
    return navigateTo('/admin/login')
  }
})
