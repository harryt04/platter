import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

let clientAddress = 1

test.beforeEach(async ({ context }) => {
  const address = `10.${process.pid % 200}.${Math.floor(clientAddress / 255)}.${clientAddress % 255}`
  clientAddress += 1
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': address })
})

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
        page.getByRole('navigation', { name: 'Shopping run views' }),
      ).toBeVisible()
      await expect(
        page.getByRole('list', { name: 'Produce grocery items' }),
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
      await expect(markPurchased).toHaveAttribute('aria-pressed', 'false')
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
      await expect(undoPurchased).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: 'Marked spinach purchased.' }),
      ).toBeVisible()
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

  test('@a11y supports arrow-key theme selection', async ({ page }) => {
    await signIn(page)
    await page.goto('/settings/appearance')

    const system = page.locator('#theme-system')
    const light = page.locator('#theme-light')
    const dark = page.locator('#theme-dark')

    await system.click()
    await expect(system).toBeFocused()
    await system.press('ArrowDown')
    await expect(light).toBeFocused()
    await expect(light).toBeChecked()
    await light.press('ArrowDown')
    await expect(dark).toBeChecked()
    await dark.press('ArrowUp')
    await expect(light).toBeChecked()

    await system.check()
  })

  test('@a11y traps and restores focus in mobile navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await signIn(page)

    const trigger = page.getByRole('button', { name: 'Open navigation' })
    await trigger.focus()
    await trigger.press('Enter')

    const navigation = page.getByRole('complementary', {
      name: 'Primary navigation',
    })
    await expect(navigation).toBeVisible()
    const closeTrigger = page
      .getByRole('main')
      .getByRole('button', { name: 'Close navigation' })
    await expect(closeTrigger).toHaveAttribute('aria-expanded', 'true')
    await expect(
      navigation.getByRole('link', { name: 'Platter home' }),
    ).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(
      navigation.getByRole('button', { name: 'Sign out' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await trigger.press('Enter')
    await expect(navigation).toBeVisible()
    await navigation.getByRole('link', { name: 'Discover' }).click()
    await expect(page).toHaveURL(/\/discover$/)
    await expect(
      page.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })
})
