import { expect, test } from '@playwright/test'

test.describe('public copyright experience', () => {
  test('explains removal requests and contact-data handling', async ({
    page,
  }) => {
    await page.goto('/copyright')

    await expect(
      page.getByRole('heading', { name: 'Copyright and removal' }),
    ).toBeVisible()
    await expect(page.getByText('How to request removal')).toBeVisible()
    await expect(
      page.getByText(/not shown on public recipe pages/i),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Report a concern' }).first().click()

    await expect(page).toHaveURL(/\/copyright\/report$/)
    await expect(
      page.getByRole('heading', { name: 'Report a copyright concern' }),
    ).toBeVisible()
    await expect(page.getByText('Include these details')).toBeVisible()
  })

  test('fits a narrow viewport without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 320 })
    await page.goto('/copyright/report')

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
