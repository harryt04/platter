import { test, expect } from '@playwright/test'

test.describe('authentication flows', () => {
  test('creates an account without browser runtime errors', async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    const email = `auth-smoke-${Date.now()}@localhost.test`
    await page.goto('/sign-up')
    await expect(
      page.getByRole('heading', { name: 'Create your Platter account' }),
    ).toBeVisible()
    await page.getByLabel('Name').fill('Browser auth smoke test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('AuthSmokePassword!2026')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/lists$/)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('signs in with the provisioned agent account without browser runtime errors', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD locally to run the agent-account auth check.',
    )

    const pageErrors: Error[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
