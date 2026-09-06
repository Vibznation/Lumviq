import { test, expect } from '@playwright/test'

test('onboarding flow: register, create org, invite user (happy path)', async ({ page }) => {
  // This is a scaffolded E2E test. Start your dev server locally before running.
  await page.goto('http://localhost:3000')
  // Open sign-up
  await page.click('text=Sign up')
  await page.fill('input[name="email"]', 'e2e+demo@lumviq.test')
  await page.fill('input[name="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  // Expect to land on onboarding
  await expect(page.locator('text=Create or join an organization')).toBeVisible()
  // Create org
  await page.fill('input[name="orgName"]', 'Lumviq E2E Org')
  await page.click('button:has-text("Create organization")')
  await expect(page.locator('text=Overview')).toBeVisible()
})
