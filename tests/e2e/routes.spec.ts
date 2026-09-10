import { test, expect } from '@playwright/test'

test('public discovery is reachable', async ({ page }) => {
  await page.goto('/discover')
  await expect(
    page.getByRole('heading', { name: 'Find something to cook' }),
  ).toBeVisible()
})

test('@a11y discovery has one page heading', async ({ page }) => {
  await page.goto('/discover')
  await expect(page.locator('h1')).toHaveCount(1)
})
