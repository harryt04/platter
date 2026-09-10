import { expect, test } from '@playwright/test'

test.describe('recipe imports', () => {
  test('queues a public URL and shows its durable status', async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD locally to run the import check.',
    )

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    const sourceUrl = `https://example.com/platter-import-${Date.now()}`
    await page.goto('/import')
    await page.getByLabel('Recipe URL').fill(sourceUrl)
    await page.getByRole('button', { name: 'Import recipe URL' }).click()

    const importRow = page.locator('li').filter({ hasText: sourceUrl })
    await expect(importRow).toContainText('Queued')
    await expect(
      page.getByText(
        'Import queued. This page will update when the preview is ready.',
      ),
    ).toBeVisible()
  })
})
