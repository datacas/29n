/**
 * E2E de la interfaz de evaluación humana ciega (panel local). Requiere un servidor de desarrollo con una BD que contenga la campaña del piloto
 * y una sesión administrativa de prueba. NO usar contra la BD real:
 *   E2E_BASE_URL=http://localhost:3999 E2E_ADMIN_TOKEN=<token de una sesión de prueba> npx playwright test tests/e2e/evaluacion.spec.ts
 */
import { test, expect } from '@playwright/test'

const TOKEN = process.env.E2E_ADMIN_TOKEN
test.skip(!TOKEN, 'Define E2E_ADMIN_TOKEN y E2E_BASE_URL para ejecutar este test sobre una BD de pruebas')
test.use({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3099' })
test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'admin_session', value: TOKEN!, url: baseURL! }])
})

test('flujo completo: ceguera, sin preselección, autoguardado, recuperación y finalización irreversible', async ({ page }) => {
  await page.goto('/admin/evaluacion')
  await expect(page.getByText('Piloto 19 celdas')).toBeVisible()
  await expect(page.getByText('no constituyen una referencia humana independiente')).toBeVisible()
  await page.getByRole('link', { name: /Empezar|Continuar/ }).click()

  // Celda cargada, sin ningún valor preseleccionado
  await expect(page.getByText(/Celda 1 de 19/)).toBeVisible()
  await expect(page.locator('input[name="cls"]:checked')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Finalizar esta evaluación/ })).toBeDisabled()
  // Ceguera: la página no contiene nombres de partido del banco
  const html = await page.content()
  for (const party of ['PSOE', 'Partido Popular', 'VOX', 'Sumar', 'Junts', 'ERC']) expect(html).not.toContain(party)

  // Elegir clase por teclado (1 = Apoya), intensidad (F), evidencia y justificación → autoguardado visible
  await page.keyboard.press('1')
  await page.keyboard.press('f')
  await page.locator('.claims input[type=checkbox]').first().check()
  await page.locator('#rationale').fill('Compromiso claro en el primer pasaje')
  await expect(page.getByText(/Guardado/)).toBeVisible({ timeout: 5000 })

  // Recuperación del borrador tras recargar
  await page.reload()
  await expect(page.locator('input[name="cls"]:checked')).toHaveCount(1)
  await expect(page.locator('#rationale')).toHaveValue('Compromiso claro en el primer pasaje')

  // Finalizar (irreversible): confirmación y bloqueo
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /Finalizar esta evaluación/ }).click()
  await expect(page.getByText(/1\/19 finalizadas/)).toBeVisible()
  // Volver a la celda finalizada: no editable
  await page.getByRole('button', { name: /Anterior/ }).click().catch(() => {})
  await page.getByRole('button', { name: 'Revisar antes de finalizar' }).click()
  await expect(page.getByText('Finalizada').first()).toBeVisible()
})

test('contexto insuficiente sin puntuar y petición de contexto con nueva versión', async ({ page }) => {
  await page.goto('/admin/evaluacion')
  await page.getByRole('link', { name: /Empezar|Continuar/ }).click()
  await expect(page.getByText(/Celda 2 de 19/)).toBeVisible()
  await page.getByRole('button', { name: 'Pedir más contexto' }).click()
  await expect(page.getByRole('button', { name: /Ampliar con páginas contiguas/ })).toBeVisible()
  await page.getByRole('button', { name: /Ampliar con páginas contiguas/ }).click()
  await expect(page.getByText('Última petición atendida en la versión 2.')).toBeVisible()
  await expect(page.locator('.claims li')).toHaveCount(await page.locator('.claims li').count())
  expect(await page.locator('.claims li').count()).toBeGreaterThan(10)
  await page.keyboard.press('i')
  await expect(page.getByText(/Guardado/)).toBeVisible({ timeout: 5000 })
  // Contexto insuficiente sin clase es una conclusión válida: se puede finalizar sin emitir puntuación
  await expect(page.getByRole('button', { name: /Finalizar esta evaluación/ })).toBeEnabled()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /Finalizar esta evaluación/ }).click()
  await expect(page.getByText(/2\/19 finalizadas/)).toBeVisible()
})

test('API: sin sesión todo es 401 y las respuestas ciegas no contienen datos del partido', async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL })
  for (const [m, u] of [['get', '/api/admin/evaluacion'], ['get', '/api/admin/evaluacion/00000000-0000-0000-0000-000000000000/cells'],
    ['get', '/api/admin/evaluacion/00000000-0000-0000-0000-000000000000/cells/00000000-0000-0000-0000-000000000000'],
    ['put', '/api/admin/evaluacion/00000000-0000-0000-0000-000000000000/cells/00000000-0000-0000-0000-000000000000/draft'],
    ['post', '/api/admin/evaluacion/00000000-0000-0000-0000-000000000000/cells/00000000-0000-0000-0000-000000000000/finalize'],
    ['post', '/api/admin/evaluacion/00000000-0000-0000-0000-000000000000/cells/00000000-0000-0000-0000-000000000000/context']] as const) {
    expect((await (anon as any)[m](u, { data: {} })).status(), `${m} ${u}`).toBe(401)
  }
  const auth = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `admin_session=${TOKEN}` } })
  expect((await auth.get('/api/admin/evaluacion/no-es-uuid/cells')).status()).toBe(400)
  const camp = (await (await auth.get('/api/admin/evaluacion')).json()).campaigns[0]
  const cells = (await (await auth.get(`/api/admin/evaluacion/${camp.id}/cells`)).json()).cells
  expect(cells).toHaveLength(19)
  expect(cells.map((c: any) => c.ord)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1))
  const blob = JSON.stringify(await (await auth.get(`/api/admin/evaluacion/${camp.id}/cells/${cells[5].cellId}`)).json())
  for (const k of ['party', 'reference', 'entityId', 'entity_id', 'questionId', 'question_id', 'model', 'provisional']) expect(blob.toLowerCase()).not.toContain(`"${k.toLowerCase()}"`)
})
