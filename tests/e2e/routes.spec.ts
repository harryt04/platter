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

test.describe('authenticated list workflow', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated browser coverage.',
  )

  test('creates three lists and completes the owner lifecycle', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    const prefix = `Browser ${Date.now()}`
    let firstListUrl = ''
    for (const suffix of ['Family', 'Guests', 'Personal']) {
      await page.getByRole('link', { name: 'New list' }).click()
      await page
        .getByRole('textbox', { name: 'List name' })
        .fill(`${prefix} ${suffix}`)
      await page.getByRole('button', { name: 'Create list' }).click()
      await expect(page).toHaveURL(/\/lists\/[^/]+$/)
      if (!firstListUrl) firstListUrl = page.url()
      await page.goto('/lists')
    }

    await expect(page.getByText(`${prefix} Family`)).toBeVisible()
    await expect(page.getByText(`${prefix} Guests`)).toBeVisible()
    await expect(page.getByText(`${prefix} Personal`)).toBeVisible()

    await page.goto(firstListUrl)
    await page.getByRole('button', { name: 'Archive list' }).click()
    await page.getByRole('button', { name: 'Archive list' }).last().click()
    await expect(page.getByText('This list is archived.')).toBeVisible()

    await page.getByRole('button', { name: 'Unarchive list' }).click()
    await page.getByRole('button', { name: 'Unarchive list' }).last().click()
    await expect(
      page.getByRole('button', { name: 'Start shopping' }),
    ).toBeVisible()
  })
})
