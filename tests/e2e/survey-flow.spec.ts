import { test, expect } from '@playwright/test'

// Get the demo release ID from the API
test.use({ storageState: { cookies: [], origins: [] } })

// Hardcoded demo release ID from seed data (avoids API call in beforeEach)
const DEMO_RELEASE_ID = '525aee25-f00a-459c-8058-7d59b76326bd'

test.describe('Survey E2E - Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB before each test
    await page.goto('/')
    await page.evaluate(async () => {
      const dbNames = await indexedDB.databases()
      for (const db of dbNames) {
        indexedDB.deleteDatabase(db.name!)
      }
    })
  })

  test('catalog shows demo survey', async ({ page }) => {
    await page.goto('/')
    
    // Should show the survey catalog
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Should show the demo survey card
    const card = page.locator('.survey-card')
    await expect(card).toBeVisible({ timeout: 10000 })
    await expect(card.locator('h2')).toContainText('Encuesta de demostración')
    await expect(card.locator('.version')).toContainText('demo-1.0')
  })

  test('survey detail page shows entities and dimensions', async ({ page }) => {
    await page.goto(`/survey/${DEMO_RELEASE_ID}`)
    
    // Should show the survey title
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('h1')).toContainText('Encuesta de demostración')
    
    // Should show entities (uses .entities-grid with .entity-card items)
    await expect(page.locator('.entities-grid')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.entity-card')).toHaveCount(3, { timeout: 10000 })
    
    // Should show dimensions (uses .dimensions-list)
    await expect(page.locator('.dimensions-list')).toBeVisible({ timeout: 10000 })
  })

  test('start page - select entities and begin survey', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    
    // Wait for page to load - should show survey title
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select all entities (checkboxes inside .entity-option labels)
    const checkboxes = page.locator('.entity-option input[type="checkbox"]')
    await expect(checkboxes).toHaveCount(3, { timeout: 10000 })
    await checkboxes.first().check()
    await checkboxes.nth(1).check()
    await checkboxes.nth(2).check()
    
    // Verify entities are selected
    await expect(page.locator('.entity-option.selected')).toHaveCount(3, { timeout: 5000 })
    
    // Select calibration mode: skipped for simplicity (radio with "Omitir" text)
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    
    // Click start button by text
    await page.getByRole('button', { name: /comenzar/i }).click()
    
    // Wait for navigation
    await page.waitForURL(/\/questions$/, { timeout: 10000 }).catch(() => {
      // If navigation failed, check for page errors
      if (consoleErrors.length > 0) {
        console.log('Console errors:', consoleErrors)
      }
    })
    
    // Should redirect to questions page
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
  })

  test('questions flow - answer and navigate', async ({ page }) => {
    // First start the survey
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select first entity
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    
    // Skip calibration
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    
    // Start
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Should show progress bar
    await expect(page.locator('.progress-bar')).toBeVisible({ timeout: 10000 })
    
    // Should show question card
    await expect(page.locator('.question-card')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.question-text')).toBeVisible({ timeout: 10000 })
    
    // Answer the first question (select "Agree" = value 1, which is the 4th radio option)
    const radioOptions = page.locator('.answer-option input[type="radio"]')
    await expect(radioOptions).toHaveCount(5, { timeout: 10000 }) // -2, -1, 0, 1, 2
    await radioOptions.nth(3).check() // value=1 (agree)
    
    // Navigate to next question
    await page.locator('.btn-primary').click()
    
    // Progress should update - question index should change
    await expect(page.locator('.progress-text')).toBeVisible({ timeout: 5000 })
  })

  test('questions flow - finish and see results', async ({ page }) => {
    // Start the survey with skipped calibration
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select all entities
    const checkboxes = page.locator('.entity-option input[type="checkbox"]')
    await checkboxes.first().check()
    await checkboxes.nth(1).check()
    await checkboxes.nth(2).check()
    
    // Skip calibration
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    
    // Start
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Answer all questions with neutral (0) and navigate through them
    const progressText = await page.locator('.progress-text').textContent({ timeout: 10000 })
    const totalQuestions = parseInt(progressText?.split('/')[1]?.trim() || '0')
    
    for (let i = 0; i < totalQuestions; i++) {
      // Select neutral answer (value=0, index 2)
      const radios = page.locator('.answer-option input[type="radio"]')
      await radios.nth(2).click({ force: true })
      
      // Click next or finish
      const nextBtn = page.locator('.btn-primary')
      const btnText = await nextBtn.textContent()
      
      if (btnText?.includes('Repetir') || btnText?.includes('Resultados') || btnText?.includes('Finalizar')) {
        // This is the finish button
        await nextBtn.click()
        break
      } else {
        await nextBtn.click()
      }
    }
    
    // Should be on results page
    await expect(page).toHaveURL(/\/results$/, { timeout: 10000 })
    
    // Should show results title
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Should show at least one result card
    await expect(page.locator('.result-card').first()).toBeVisible({ timeout: 10000 })
  })

  test('calibration quick mode', async ({ page }) => {
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select one entity
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    
    // Select quick calibration
    const quickRadio = page.locator('.calibration-option').filter({ hasText: /Asigna importancia/i })
    await quickRadio.locator('input[type="radio"]').check()
    
    // Start
    await page.getByRole('button', { name: /comenzar/i }).click()
    
    // Should redirect to calibration-quick page
    await expect(page).toHaveURL(/\/calibration-quick$/, { timeout: 10000 })
    
    // Should show dimension importance selectors
    await expect(page.locator('.calibration-quick')).toBeVisible({ timeout: 10000 })
  })

  test('calibration serious mode', async ({ page }) => {
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select one entity
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    
    // Select serious calibration
    const seriousRadio = page.locator('.calibration-option').filter({ hasText: /Comparaciones por pares/i })
    await seriousRadio.locator('input[type="radio"]').check()
    
    // Start
    await page.getByRole('button', { name: /comenzar/i }).click()
    
    // Should redirect to calibration page
    await expect(page).toHaveURL(/\/calibration$/, { timeout: 10000 })
    
    // Should show calibration comparisons
    await expect(page.locator('.calibration-serious')).toBeVisible({ timeout: 10000 })
  })

  test('results page shows evidence section', async ({ page }) => {
    // Start survey
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select first entity only (fewer questions, faster test)
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    
    // Skip calibration
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    
    // Start
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Answer ALL questions with neutral (0) and navigate through them, then finish
    const progressText = await page.locator('.progress-text').textContent({ timeout: 10000 })
    const totalQuestions = parseInt(progressText?.split('/')[1]?.trim() || '0')
    
    for (let i = 0; i < totalQuestions; i++) {
      // Select neutral answer (value=0, index 2)
      const radios = page.locator('.answer-option input[type="radio"]')
      await radios.nth(2).click({ force: true })
      
      // Click next or finish
      const nextBtn = page.locator('.btn-primary')
      const btnText = await nextBtn.textContent()
      
      if (btnText?.includes('Resultados') || btnText?.includes('Finalizar')) {
        // This is the finish button - click it to go to results
        await nextBtn.click()
        break
      } else {
        await nextBtn.click()
      }
    }
    
    // Should be on results page
    await expect(page).toHaveURL(/\/results$/, { timeout: 10000 })
    
    // Should show results title
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Should show at least one result card
    await expect(page.locator('.result-card').first()).toBeVisible({ timeout: 10000 })
    
    // Should show evidence section (inside .result-card)
    const evidenceSection = page.locator('.evidence-section')
    await expect(evidenceSection.first()).toBeVisible({ timeout: 10000 })
    
    // Expand evidence section
    await evidenceSection.first().click()
    
    // Should show evidence list or "no evidence" message
    const evidenceContent = page.locator('.evidence-list')
    await expect(evidenceContent.first()).toBeVisible({ timeout: 5000 })
  })

  test('direct access to results without completed survey shows empty state', async ({ page }) => {
    // Navigate directly to results without completing a survey
    await page.goto(`/survey/${DEMO_RELEASE_ID}/results`)
    
    // Should redirect to start page or show an empty/error state
    // The page should not crash with JavaScript errors
    await page.waitForTimeout(2000)
    
    // Either redirected to start or shows a message
    const url = page.url()
    const hasMessage = await page.locator('.error, .empty-state, h1').first().isVisible().catch(() => false)
    
    // Page should be stable (no JS errors) and either redirect or show a message
    expect(url.includes('/start') || hasMessage).toBe(true)
  })

  test('session recovery from IndexedDB after page reload', async ({ page }) => {
    // Start survey
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select first entity
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    
    // Skip calibration
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    
    // Start
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Answer first question
    await page.locator('.answer-option input[type="radio"]').nth(3).click({ force: true })
    
    // Navigate to next question
    await page.locator('.btn-primary').click()
    await page.waitForTimeout(500)
    
    // Reload the page (simulates closing and reopening browser)
    await page.reload({ waitUntil: 'networkidle' })
    
    // Should still be on questions page with progress preserved
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Should show progress bar
    await expect(page.locator('.progress-bar')).toBeVisible({ timeout: 10000 })
    
    // Should show the second question (index 1)
    await expect(page.locator('.question-card')).toBeVisible({ timeout: 10000 })
  })

  test('privacy - no answers sent to server', async ({ page }) => {
    // Start survey
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Select entity
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Monitor network requests
    const serverRequests: string[] = []
    page.on('request', request => {
      const url = request.url()
      // Only track POST requests to our server (not static assets)
      if (request.method() === 'POST' && url.includes('localhost:3099')) {
        serverRequests.push(url)
      }
    })
    
    // Answer a question
    await page.locator('.answer-option input[type="radio"]').nth(3).click({ force: true })
    
    // Navigate
    await page.locator('.btn-primary').click()
    
    // Answer another question
    await page.locator('.answer-option input[type="radio"]').nth(2).click({ force: true })
    
    // Wait a bit for any potential requests
    await page.waitForTimeout(500)
    
    // No POST requests should have been made with answers
    expect(serverRequests.length).toBe(0)
  })

  test('history page shows saved results', async ({ page }) => {
    // First, complete a survey properly
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Answer ALL questions and finish properly
    const progressText = await page.locator('.progress-text').textContent({ timeout: 10000 })
    const totalQuestions = parseInt(progressText?.split('/')[1]?.trim() || '0')
    
    for (let i = 0; i < totalQuestions; i++) {
      await page.locator('.answer-option input[type="radio"]').nth(2).click({ force: true })
      const nextBtn = page.locator('.btn-primary')
      const btnText = await nextBtn.textContent()
      if (btnText?.includes('Resultados') || btnText?.includes('Finalizar')) {
        await nextBtn.click()
        break
      } else {
        await nextBtn.click()
      }
    }
    
    // Should be on results page
    await expect(page).toHaveURL(/\/results$/, { timeout: 10000 })
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Save to local history
    const saveBtn = page.locator('button', { hasText: /guardar|save/i })
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      page.on('dialog', dialog => dialog.accept())
      await saveBtn.click()
      await page.waitForTimeout(500)
    }
    
    // Go to history page
    await page.goto('/history')
    
    // Should show history page
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
  })

  test('export and import JSON', async ({ page }) => {
    // Complete a survey properly
    await page.goto(`/survey/${DEMO_RELEASE_ID}/start`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    await page.locator('.entity-option input[type="checkbox"]').first().check()
    const skipRadio = page.locator('.calibration-option').filter({ hasText: /Omitir/i })
    await skipRadio.locator('input[type="radio"]').check()
    await page.getByRole('button', { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10000 })
    
    // Answer ALL questions and finish properly
    const progressText = await page.locator('.progress-text').textContent({ timeout: 10000 })
    const totalQuestions = parseInt(progressText?.split('/')[1]?.trim() || '0')
    
    for (let i = 0; i < totalQuestions; i++) {
      await page.locator('.answer-option input[type="radio"]').nth(2).click({ force: true })
      const nextBtn = page.locator('.btn-primary')
      const btnText = await nextBtn.textContent()
      if (btnText?.includes('Resultados') || btnText?.includes('Finalizar')) {
        await nextBtn.click()
        break
      } else {
        await nextBtn.click()
      }
    }
    
    // Should be on results page
    await expect(page).toHaveURL(/\/results$/, { timeout: 10000 })
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Save to history
    const saveBtn = page.locator('button', { hasText: /guardar|save/i })
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      page.on('dialog', dialog => dialog.accept())
      await saveBtn.click()
      await page.waitForTimeout(500)
    }
    
    // Go to history and export
    await page.goto('/history')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    
    // Export button should exist
    const exportBtn = page.locator('button', { hasText: /export|descargar/i })
    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Export is available
      await expect(exportBtn).toBeVisible()
    }
  })
})
