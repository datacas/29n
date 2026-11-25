/** E2E del panel de métricas sobre una BD de PRUEBAS (copia de la local con 010–012 y las codificaciones de IA importadas). NO usar contra la BD real. */
import { test, expect } from '@playwright/test'
const TOKEN = process.env.E2E_ADMIN_TOKEN
test.skip(!TOKEN, 'Define E2E_ADMIN_TOKEN y E2E_BASE_URL')
test.use({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3099' })
test.beforeEach(async ({ context, baseURL }) => { await context.addCookies([{ name: 'admin_session', value: TOKEN!, url: baseURL! }]) })

test('métricas separadas y filas «humanas» del piloto marcadas como no humanas', async ({ page, playwright, baseURL }) => {
  expect((await (await playwright.request.newContext({ baseURL })).get('/api/admin/metricas')).status()).toBe(401)
  await page.goto('/admin/metricas'); await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: '1. IA–IA' })).toBeVisible()
  await expect(page.getByText(/α nominal 0\.\d+/).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /Filas «humanas» NO verificadas \(ai_agent\)/ })).toBeVisible()
  await expect(page.getByText('Filas registradas como humanas producidas por un agente de IA: son IA–IA, NO humano–IA.')).toBeVisible()
  await expect(page.getByText(/No disponible: No hay codificaciones humanas con procedencia verificada/)).toBeVisible()
  await expect(page.getByText(/No disponible: Requiere ≥ 2 evaluadores humanos externos/)).toBeVisible()
  await expect(page.getByText(/No disponible: Sin campañas de repetibilidad/)).toBeVisible()
})
