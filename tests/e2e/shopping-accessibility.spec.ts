import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(userEmail!)
  await page.getByLabel('Password').fill(userPassword!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/lists$/)
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([])
}

async function expectReducedMotion(page: Page) {
  const longestMotionInMilliseconds = await page.evaluate(() => {
    const toMilliseconds = (value: string) => {
      const number = Number.parseFloat(value)
      return value.trim().endsWith('s') && !value.trim().endsWith('ms')
        ? number * 1000
        : number
    }
    return Array.from(document.querySelectorAll<HTMLElement>('*')).reduce(
      (longest, element) => {
        const styles = getComputedStyle(element)
        const durations = [
          ...styles.transitionDuration.split(','),
          ...styles.animationDuration.split(','),
        ].map(toMilliseconds)
        return Math.max(longest, ...durations)
      },
      0,
    )
  })
  expect(longestMotionInMilliseconds).toBeLessThanOrEqual(0.1)
}

test.describe('shopping responsive and theme accessibility', () => {
  test.skip(
    !userEmail || !userPassword,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated browser coverage.',
  )

  test('@a11y keeps the checklist usable at 320px in every theme', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.emulateMedia({ colorScheme: 'light' })
    await signIn(page)

    const listResponse = await page.request.post('/api/v1/lists', {
      data: { name: `Accessibility checklist ${Date.now()}` },
    })
    expect(listResponse.status()).toBe(201)
    const listBody = (await listResponse.json()) as {
      list: { id: string; activeRunId: string }
    }
    const listId = listBody.list.id
    const shopUrl = `/lists/${listId}/shop`

    const manualResponse = await page.request.post(
      `/api/v1/lists/${listId}/manual-items`,
      {
        data: {
          line: '2 bags spinach',
          runId: listBody.list.activeRunId,
          operationId: `accessibility-manual-${Date.now()}`,
          clientId: `accessibility-client-${Date.now()}`,
          baseRevision: 0,
        },
      },
    )
    expect(manualResponse.status()).toBe(201)

    for (const theme of [
      { name: 'System', colorScheme: 'light' as const, dark: false },
      { name: 'System', colorScheme: 'dark' as const, dark: true },
      { name: 'Light', colorScheme: 'light' as const, dark: false },
      { name: 'Dark', colorScheme: 'dark' as const, dark: true },
    ]) {
      await page.emulateMedia({
        colorScheme: theme.colorScheme,
        reducedMotion: 'reduce',
      })
      await page.goto('/settings/appearance')
      await page.locator(`#theme-${theme.name.toLowerCase()}`).check()
      await page.goto(shopUrl)

      await expect(
        page.getByRole('heading', { name: 'Shopping run' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Mark spinach purchased' }),
      ).toBeVisible()
      await expect
        .poll(() =>
          page
            .locator('html')
            .evaluate((element) => element.classList.contains('dark')),
        )
        .toBe(theme.dark)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)

      const markPurchased = page.getByRole('button', {
        name: 'Mark spinach purchased',
      })
      expect(
        (await markPurchased.boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(44)
      await expectAccessible(page)
      await expectReducedMotion(page)
      await markPurchased.focus()
      await expect(markPurchased).toBeFocused()
      await markPurchased.press('Enter')
      const undoPurchased = page.getByRole('button', {
        name: 'Undo purchased for spinach',
      })
      await expect(undoPurchased).toBeVisible()
      await expect(undoPurchased).toBeEnabled()
      await undoPurchased.click()
      await expect(markPurchased).toBeVisible()
    }

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(shopUrl)
    await expect(
      page.getByRole('heading', { name: 'Shopping run' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)

    const archiveResponse = await page.request.patch(
      `/api/v1/lists/${listId}`,
      { data: { status: 'archived' } },
    )
    expect(archiveResponse.status()).toBe(200)
    await page.goto(shopUrl)
    await expect(
      page.getByText(
        'This list is archived. The shopping run is read-only until an owner unarchives it.',
      ),
    ).toBeVisible()
    await expectAccessible(page)
  })
})
