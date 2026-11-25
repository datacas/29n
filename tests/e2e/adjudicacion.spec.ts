/** E2E de la adjudicación en sombra. Requiere una BD de PRUEBAS con la campaña evaluada y la cola construida (ver evaluacion.spec.ts). NO usar contra la BD real. */
import { test, expect } from '@playwright/test'
const TOKEN = process.env.E2E_ADMIN_TOKEN
test.skip(!TOKEN, 'Define E2E_ADMIN_TOKEN y E2E_BASE_URL para ejecutar este test sobre una BD de pruebas')
test.use({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3099' })
test.beforeEach(async ({ context, baseURL }) => { await context.addCookies([{ name: 'admin_session', value: TOKEN!, url: baseURL! }]) })

test('cola, expediente completo, formulario sin preselección y registro de una adjudicación con varias causas', async ({ page, playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL })
  expect((await anon.get('/api/admin/adjudicacion')).status()).toBe(401)
  expect((await anon.post('/api/admin/adjudicacion/00000000-0000-0000-0000-000000000000', { data: {} })).status()).toBe(401)

  await page.goto('/admin/adjudicacion')
  await expect(page.locator('.review-table tbody tr')).toHaveCount(8)
  await expect(page.getByText('Zona no ciega')).toBeVisible()
  await page.locator('.review-table tbody tr').first().getByRole('link', { name: 'Abrir' }).click()
  for (const t of ['Pregunta y contexto', 'Discrepancias detectadas', 'Evaluaciones', 'Programa original', 'Tu adjudicación']) await expect(page.getByRole('heading', { name: new RegExp(t) })).toBeVisible()
  await expect(page.getByText('Referencia provisional').first()).toBeVisible()
  await expect(page.getByText('(humano interno)')).toBeVisible()
  await expect(page.locator('input[name="dc"]:checked')).toHaveCount(0)             // sin preselección
  await expect(page.locator('.form-card input[type=checkbox]:checked')).toHaveCount(0)
  const save = page.getByRole('button', { name: /Registrar adjudicación/ })
  await expect(save).toBeDisabled()

  await page.getByText('Se opone', { exact: true }).last().click()
  await page.getByText('-1', { exact: true }).click()
  await page.getByLabel('Posición omitida').check(); await page.getByLabel('Error de intensidad').check()
  await page.locator('#act').selectOption('add_position')
  await page.locator('#why').fill('Verificado en el programa original')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText('Adjudicación registrada (revisión 1).')).toBeVisible()
  await expect(page.getByText(/Rev\. 1/)).toBeVisible()

  await page.goto('/admin/adjudicacion')
  await expect(page.getByText('Adjudicada (rev. 1)')).toBeVisible()
  await expect(page.getByText(/Posición omitida: 1/)).toBeVisible()
})
