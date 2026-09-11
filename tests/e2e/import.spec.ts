import { expect, test } from '@playwright/test'

let clientAddress = 1

test.beforeEach(async ({ context }) => {
  const address = `10.${process.pid % 200}.${Math.floor(clientAddress / 255)}.${clientAddress % 255}`
  clientAddress += 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': address })
})

const hasPublishedHostedPolicy =
  process.env.PUBLIC_CATALOG_POLICIES_PUBLISHED === 'true' &&
  Boolean(
    process.env.PUBLIC_CATALOG_TERMS_URL &&
    process.env.PUBLIC_CATALOG_PRIVACY_URL &&
    process.env.PUBLIC_CATALOG_REMOVAL_CONTACT &&
    process.env.PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL,
  )
const importsRequested = process.env.RECIPE_IMPORTS_ENABLED !== 'false'

test.describe('recipe imports', () => {
  test('queues a public URL and shows its durable status', async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL ||
        !process.env.E2E_USER_PASSWORD ||
        !importsRequested ||
        !hasPublishedHostedPolicy,
      'Set E2E credentials and complete the hosted public-catalog policy configuration to run the import check.',
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

  test('explains the hosted policy gate when public imports are not configured', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL ||
        !process.env.E2E_USER_PASSWORD ||
        !importsRequested ||
        hasPublishedHostedPolicy,
      'Run this check with E2E credentials and incomplete hosted policy configuration.',
    )

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/import')
    await expect(
      page.getByText(/must publish and configure the terms/i),
    ).toBeVisible()
    await expect(page.getByLabel('Recipe URL')).toBeDisabled()
  })

  test('keeps self-hosted defaults usable without paid integrations', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL ||
        !process.env.E2E_USER_PASSWORD ||
        process.env.E2E_SELF_HOSTED_MODE !== 'true' ||
        !importsRequested ||
        hasPublishedHostedPolicy,
      'Set E2E_SELF_HOSTED_MODE=true and run against a non-production self-hosted instance with the default optional integrations disabled.',
    )

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/import')
    await expect(page.getByLabel('Recipe URL')).toBeEnabled()
    await page
      .getByLabel('Recipe URL')
      .fill('https://example.com/self-hosted-default')
    await expect(
      page.getByRole('button', { name: 'Import recipe URL' }),
    ).toBeEnabled()
    await expect(
      page.getByText(/paid recipe API|paid integrations/i),
    ).toHaveCount(0)
  })
})
