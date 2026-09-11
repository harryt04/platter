import { test, expect } from '@playwright/test'

test.describe('account deletion', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD locally to run account deletion coverage.',
  )

  test('shows an explicit, password-protected confirmation without submitting it', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/settings/account')
    await page.getByRole('button', { name: 'Delete account' }).click()
    await expect(
      page.getByRole('heading', { name: 'Delete your Platter account?' }),
    ).toBeVisible()
    await expect(page.getByText(/This cannot be undone/i)).toBeVisible()

    const deleteButton = page.getByRole('button', {
      name: 'Delete permanently',
    })
    await expect(deleteButton).toBeDisabled()
    await page
      .getByLabel(`Type ${process.env.E2E_USER_EMAIL} to confirm`)
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Enter your password').fill('not-submitted')
    await expect(deleteButton).toBeEnabled()
  })

  test('deletes a disposable account after explicit confirmation', async ({
    page,
  }) => {
    const email = `account-delete-${Date.now()}@localhost.test`
    const password = 'AccountDeletePassword!2026'
    await page.goto('/sign-up')
    await page.getByLabel('Name').fill('Disposable deletion test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/settings/account')
    await page.getByRole('button', { name: 'Delete account' }).click()
    await page.getByLabel(`Type ${email} to confirm`).fill(email)
    await page.getByLabel('Enter your password').fill(password)
    await page.getByRole('button', { name: 'Delete permanently' }).click()
    await expect(page).toHaveURL(/\/sign-in\?deleted=1$/)
  })
})
