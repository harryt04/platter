import { test, expect } from '@playwright/test'

test.describe('account export', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD locally to run account export coverage.',
  )

  test('prepares and downloads an authenticated account export', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/settings/account')
    await expect(
      page.getByRole('heading', { name: 'Account data' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Before you delete your account' }),
    ).toBeVisible()
    await expect(page.getByText('Owned lists')).toBeVisible()
    await page.getByRole('button', { name: 'Prepare account export' }).click()

    const downloadLink = page.getByRole('link', {
      name: 'Download account export',
    })
    await expect(downloadLink).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await downloadLink.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('platter-account-export.json')
  })
})
