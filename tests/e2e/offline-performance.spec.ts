import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD
const cachedOfflineNavigationBudgetMs = 2_000
const optimisticChecklistBudgetMs = 500

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(userEmail!)
  await page.getByLabel('Password').fill(userPassword!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/lists$/)
}

async function waitForServiceWorkerControl(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
}

async function setMidRangeCpuProfile(context: BrowserContext, page: Page) {
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
}

async function waitForRunSnapshot(page: Page, listName: string) {
  await expect
    .poll(() =>
      page.evaluate(async (expectedListName) => {
        const userId = window.localStorage.getItem('platter-offline-user-id')
        if (!userId) return false

        return await new Promise<boolean>((resolve) => {
          const request = window.indexedDB.open(`platter-${userId}`)
          request.onerror = () => resolve(false)
          request.onsuccess = () => {
            const database = request.result
            if (!database.objectStoreNames.contains('snapshots')) {
              database.close()
              resolve(false)
              return
            }
            const transaction = database.transaction('snapshots', 'readonly')
            const snapshots = transaction.objectStore('snapshots').getAll()
            snapshots.onerror = () => resolve(false)
            snapshots.onsuccess = () => {
              resolve(
                snapshots.result.some(
                  (snapshot) => snapshot.payload?.listName === expectedListName,
                ),
              )
              database.close()
            }
          }
        })
      }, listName),
    )
    .toBe(true)
}

test.describe('offline mobile performance', () => {
  test.use({
    deviceScaleFactor: 2,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })

  test('@performance keeps cached shell and optimistic checklist feedback within budget', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' || !userEmail || !userPassword,
      'Run this Chromium mobile check with the provisioned E2E account.',
    )

    await setMidRangeCpuProfile(context, page)
    await signIn(page)

    const suffix = Date.now()
    const listName = `Offline performance ${suffix}`
    const listResponse = await page.request.post('/api/v1/lists', {
      data: { name: listName },
    })
    expect(listResponse.status()).toBe(201)
    const listBody = (await listResponse.json()) as {
      list: { id: string; activeRunId: string }
    }
    const listId = listBody.list.id
    const itemResponse = await page.request.post(
      `/api/v1/lists/${listId}/manual-items`,
      {
        data: {
          line: '2 bags spinach',
          runId: listBody.list.activeRunId,
          operationId: `offline-performance-${suffix}`,
          clientId: `offline-performance-client-${suffix}`,
          baseRevision: 0,
        },
      },
    )
    expect(itemResponse.status()).toBe(201)

    const shopUrl = `/lists/${listId}/shop`
    await page.goto('/lists')
    await expect(
      page.locator('main').getByText(listName, { exact: true }),
    ).toBeVisible()
    await page.goto(shopUrl)
    await expect(
      page.getByRole('button', { name: 'Mark spinach purchased' }),
    ).toBeVisible()
    await waitForRunSnapshot(page, listName)

    // Visit the public offline route once so the production service worker
    // has installed and its shell fallback has a browser-cache entry.
    await page.goto('/offline')
    await page.reload()
    await waitForServiceWorkerControl(page)
    await expect(
      page.getByRole('heading', { name: 'Saved shopping runs' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: listName, exact: true }),
    ).toBeVisible()

    await context.setOffline(true)
    const navigationStartedAt = await page.evaluate(() => performance.now())
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Saved shopping runs' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: listName, exact: true }),
    ).toBeVisible()
    const cachedNavigationMs = await page.evaluate(
      (startedAt) => performance.now() - startedAt,
      navigationStartedAt,
    )
    expect(cachedNavigationMs).toBeLessThan(cachedOfflineNavigationBudgetMs)

    await context.setOffline(false)
    await page.goto(shopUrl)
    await expect(
      page.getByRole('button', { name: 'Mark spinach purchased' }),
    ).toBeVisible()
    await context.setOffline(true)

    const purchaseButton = page.getByRole('button', {
      name: 'Mark spinach purchased',
    })
    const optimisticStartedAt = await page.evaluate(() => performance.now())
    await purchaseButton.click()
    await expect(
      page.getByRole('button', { name: 'Undo purchased for spinach' }),
    ).toBeVisible()
    const optimisticFeedbackMs = await page.evaluate(
      (startedAt) => performance.now() - startedAt,
      optimisticStartedAt,
    )
    expect(optimisticFeedbackMs).toBeLessThan(optimisticChecklistBudgetMs)
  })
})
