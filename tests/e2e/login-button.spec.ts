import { test, expect } from '@playwright/test'

test('login button enables after typing email', async ({ page }) => {
  await page.goto('/admin/login')
  
  const emailInput = page.locator('#email')
  const button = page.locator('button:has-text("Solicitar código")')
  
  // Button should be disabled initially
  await expect(button).toBeDisabled()
  
  // Type an email
  await emailInput.fill('admin@example.com')
  
  // Button should now be enabled
  await expect(button).toBeEnabled()
  
  // Click the button
  await button.click()
  
  // Should show the code step
  await expect(page.locator('.mock-code')).toBeVisible()
})
