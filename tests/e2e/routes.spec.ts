import { test, expect } from '@playwright/test'

test('public discovery is reachable', async ({ page }) => {
  await page.goto('/discover')
  await expect(
    page.getByRole('heading', { name: 'Find something to cook' }),
  ).toBeVisible()
})

test('serves browser and installable PWA icon assets', async ({ request }) => {
  const icon = await request.get('/icon.svg')
  expect(icon.ok()).toBe(true)
  expect(icon.headers()['content-type']).toContain('image/svg+xml')

  const appleIcon = await request.get('/apple-icon.png')
  expect(appleIcon.ok()).toBe(true)
  expect(appleIcon.headers()['content-type']).toContain('image/png')

  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  expect(await manifest.json()).toMatchObject({
    icons: expect.arrayContaining([
      expect.objectContaining({
        src: '/icons/platter-192.png',
        purpose: 'any',
      }),
      expect.objectContaining({
        src: '/icons/platter-maskable-512.png',
        purpose: 'maskable',
      }),
    ]),
  })
})

test('@a11y discovery has one page heading', async ({ page }) => {
  await page.goto('/discover')
  await expect(page.locator('h1')).toHaveCount(1)
})

test('public visitors are sent to sign in before opening a checklist', async ({
  page,
}) => {
  await page.goto('/lists/public-checklist/shop')
  await expect(page).toHaveURL(
    /\/sign-in\?returnTo=%2Flists%2Fpublic-checklist%2Fshop$/,
  )
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
})

test.describe('authenticated list workflow', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated browser coverage.',
  )

  test('@a11y keeps recipe editor ordering keyboard-operable', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/recipes/new')
    await page
      .getByRole('textbox', { name: 'Recipe title' })
      .fill(`Keyboard recipe ${Date.now()}`)
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page).toHaveURL(/\/recipes\/[^/]+\/edit$/)

    await page.getByRole('button', { name: 'Add instruction' }).click()
    await page.getByRole('button', { name: 'Add instruction' }).click()

    const moveDown = page.getByRole('button', { name: 'Move step 1 down' })
    await moveDown.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('button', { name: 'Move step 2 up' }),
    ).toBeFocused()

    const removeFirst = page.getByRole('button', { name: 'Remove step 1' })
    await removeFirst.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('button', { name: 'Remove step 1' }),
    ).toBeFocused()
  })

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

  test('lets a member open the categorized checklist but denies a non-member', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    await page
      .getByRole('textbox', { name: 'List name' })
      .fill(`Checklist access ${Date.now()}`)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)
    const listUrl = page.url()
    const checklistUrl = `${listUrl}/shop`

    await page.goto(checklistUrl)
    await expect(
      page.getByRole('heading', { name: 'Shopping run' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Grocery items', exact: true }),
    ).toBeVisible()

    const browser = page.context().browser()
    expect(browser).toBeTruthy()
    const outsiderContext = await browser!.newContext()
    const outsiderPage = await outsiderContext.newPage()
    try {
      await outsiderPage.goto('/sign-up')
      await outsiderPage.getByLabel('Name').fill('Checklist outsider')
      await outsiderPage
        .getByLabel('Email')
        .fill(`checklist-outsider-${Date.now()}@localhost.test`)
      await outsiderPage
        .getByLabel('Password')
        .fill('ChecklistOutsiderPassword!2026')
      await outsiderPage.getByRole('button', { name: 'Create account' }).click()
      await expect(outsiderPage).toHaveURL(/\/lists$/)

      await outsiderPage.goto(checklistUrl)
      await expect(
        outsiderPage.getByRole('heading', { name: 'Page not found' }),
      ).toBeVisible()
    } finally {
      await outsiderContext.close()
    }
  })

  test('adds a four-person recipe for two and six people with explicit actions', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_SCALE_RECIPE_ID,
      'Set E2E_SCALE_RECIPE_ID to a public usable recipe for serving-scale browser coverage.',
    )

    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    const twoPeopleList = `Scale two ${Date.now()}`
    await page.getByRole('textbox', { name: 'List name' }).fill(twoPeopleList)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/(?!new$)[^/]+$/)

    await page.goto('/lists/new')
    const sixPeopleList = `Scale six ${Date.now()}`
    await page.getByRole('textbox', { name: 'List name' }).fill(sixPeopleList)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)

    await page.goto(`/recipes/${process.env.E2E_SCALE_RECIPE_ID}`)
    const list = page.getByLabel('List')
    const people = page.getByLabel('People')

    await list.selectOption({ label: twoPeopleList })
    await people.fill('2')
    await page.getByRole('button', { name: 'Add to this week' }).click()
    await expect(page.getByText(/scale 0\.5/)).toBeVisible()

    await list.selectOption({ label: sixPeopleList })
    await people.fill('6')
    await page.getByRole('button', { name: 'Add to this week' }).click()
    await expect(page.getByText(/scale 1\.5/)).toBeVisible()
  })

  test('adds, edits, and removes a manual grocery item without changing recipes', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    await page
      .getByRole('textbox', { name: 'List name' })
      .fill(`Manual groceries ${Date.now()}`)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)

    await page
      .getByRole('link', { name: 'Review at home', exact: true })
      .click()
    await page.getByLabel('Add a grocery item').fill('2 bags spinach')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByLabel('Manual grocery item 1')).toHaveValue(
      '2 bags spinach',
    )
    await expect(page.getByText('spinach', { exact: true })).toBeVisible()
    await page.getByLabel('Shopping amount for spinach').fill('3.5')
    await page.getByRole('button', { name: 'Set shopping amount' }).click()
    await expect(page.getByLabel('Shopping amount for spinach')).toHaveValue(
      '3.5',
    )
    await expect(
      page.getByText('Calculated requirement: 2 bag').first(),
    ).toBeVisible()

    await page.getByLabel('Manual grocery item 1').fill('3 bags spinach')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByLabel('Manual grocery item 1')).toHaveValue(
      '3 bags spinach',
    )
    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('button', { name: 'Remove item' }).click()
    await expect(page.getByLabel('Manual grocery item 1')).toHaveCount(0)

    await page.getByRole('link', { name: 'Start shopping' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+\/shop$/)
    await expect(
      page.getByRole('link', { name: 'Review at home', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('link', { name: 'Review at home', exact: true })
      .click()
    await expect(page).toHaveURL(/\/lists\/[^/]+\/review$/)
  })

  test('confirms completion and opens a clean shopping run', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    await page
      .getByRole('textbox', { name: 'List name' })
      .fill(`Complete run ${Date.now()}`)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)

    await page.getByRole('link', { name: 'Start shopping' }).click()
    await expect(
      page.getByRole('button', { name: 'Complete shopping run' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Complete shopping run' }).click()
    await expect(
      page.getByText(
        /starts one empty shopping run.*purchased and already-have states are not/i,
      ),
    ).toBeVisible()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Complete shopping run' })
      .click()

    await expect(
      page.getByText('Run completed. A fresh shopping run is ready.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('This shopping run has no grocery items yet.'),
    ).toBeVisible()
  })

  test('browses completed shopping runs by list and date', async ({ page }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    await page
      .getByRole('textbox', { name: 'List name' })
      .fill(`History browse ${Date.now()}`)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/(?!new$)[^/]+$/)
    const listUrl = page.url()

    await page.getByRole('link', { name: 'Start shopping' }).click()
    await page.getByRole('button', { name: 'Complete shopping run' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Complete shopping run' })
      .click()
    await expect(
      page.getByText('Run completed. A fresh shopping run is ready.', {
        exact: true,
      }),
    ).toBeVisible()

    await page.goto(listUrl)
    await page.getByRole('link', { name: 'Shopping history' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+\/history$/)
    await expect(
      page.getByRole('heading', { name: 'Completed runs' }),
    ).toBeVisible()
    await expect(page.getByText('Shopped for', { exact: true })).toBeVisible()
    await expect(page.locator('time')).toHaveCount(1)

    await page.locator('time').first().click()
    await expect(
      page.getByRole('heading', { name: 'Completed shopping run' }),
    ).toBeVisible()
    await expect(page.getByText(/Completed by/)).toBeVisible()
    await expect(
      page.getByText('No recipes were selected for this shopping run.'),
    ).toBeVisible()
    await expect(page.getByText('Purchased', { exact: true })).toHaveCount(0)
  })

  test('resolves and repeats a completed recipe run without restoring checklist state', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    const listResponse = await page.request.post('/api/v1/lists', {
      data: { name: `History repeat ${Date.now()}` },
    })
    expect(listResponse.status()).toBe(201)
    const listBody = (await listResponse.json()) as {
      list: { id: string; activeRunId: string }
    }
    const listId = listBody.list.id

    const recipeTitle = `History repeat recipe ${Date.now()}`
    const recipeResponse = await page.request.post('/api/v1/recipes', {
      data: { title: recipeTitle },
    })
    expect(recipeResponse.status()).toBe(201)
    const recipeBody = (await recipeResponse.json()) as {
      recipe: { id: string }
    }
    const recipeId = recipeBody.recipe.id

    const recipeUpdate = await page.request.patch(
      `/api/v1/recipes/${recipeId}`,
      {
        data: {
          typicalPeopleFed: 4,
          ingredients: [
            {
              originalText: '1 lime',
              quantity: '1',
              unit: 'each',
              ingredientName: 'lime',
              optional: false,
            },
          ],
        },
      },
    )
    expect(recipeUpdate.status()).toBe(200)

    const sharingResponse = await page.request.put(
      `/api/v1/recipes/${recipeId}/shares`,
      { data: { listIds: [listId], publishPublic: false } },
    )
    expect(sharingResponse.status()).toBe(200)

    const selectionResponse = await page.request.post(
      `/api/v1/lists/${listId}/selections`,
      {
        data: {
          recipeId,
          desiredPeople: 6,
          runId: listBody.list.activeRunId,
          operationId: `history-repeat-selection-${Date.now()}`,
          clientId: `history-repeat-client-${Date.now()}`,
          baseRevision: 0,
        },
      },
    )
    expect(selectionResponse.status()).toBe(201)

    await page.goto(`/lists/${listId}`)
    await expect(page.getByText(recipeTitle)).toBeVisible()
    await page.goto(`/lists/${listId}/shop`)
    await expect(
      page.getByRole('heading', { name: 'Grocery items', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Complete shopping run' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Complete shopping run' })
      .click()
    await expect(
      page.getByText('Run completed. A fresh shopping run is ready.', {
        exact: true,
      }),
    ).toBeVisible()

    await page.goto(`/lists/${listId}/history`)
    await expect(page.locator('time')).toHaveCount(1)
    await page.locator('time').first().click()
    await expect(page.getByText(recipeTitle)).toBeVisible()
    await expect(page.getByText('Version 2 · 6 people')).toBeVisible()
    await expect(page.getByText('Purchased', { exact: true })).toHaveCount(0)

    await page
      .getByRole('button', { name: 'Add these recipes to this week' })
      .click()
    await expect(
      page.getByText('1 recipe was added to the current shopping run.', {
        exact: true,
      }),
    ).toBeVisible()

    await page.goto(`/lists/${listId}`)
    await expect(page.getByText(recipeTitle)).toBeVisible()
    await expect(page.getByLabel(`People for ${recipeTitle}`)).toHaveValue('6')
  })

  test('checks and unchecks a grocery item independently while shopping', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    await page
      .getByRole('textbox', { name: 'List name' })
      .fill(`Purchased groceries ${Date.now()}`)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)

    await page
      .getByRole('link', { name: 'Review at home', exact: true })
      .click()
    await page.getByLabel('Add a grocery item').fill('2 bags spinach')
    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('link', { name: 'Start shopping' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+\/shop$/)

    const groceryRow = page
      .locator('[role="listitem"]')
      .filter({ hasText: 'spinach' })
      .first()
    await expect(groceryRow).toContainText('2 bag')
    await expect(groceryRow).toContainText('spinach')
    await expect(groceryRow).toContainText('Produce')
    await expect(groceryRow).toContainText('To buy')
    await expect(
      groceryRow.getByText('View contribution', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)

    const markPurchased = page.getByRole('button', {
      name: 'Mark spinach purchased',
    })
    await expect(markPurchased).toBeVisible()
    expect(
      (await markPurchased.boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44)
    await markPurchased.click()
    await expect(
      page.getByRole('button', { name: 'Undo purchased for spinach' }),
    ).toBeVisible()
    await expect(
      page.getByText('Purchased', { exact: true }).last(),
    ).toBeVisible()

    await page
      .getByRole('button', { name: 'Undo purchased for spinach' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Mark spinach purchased' }),
    ).toBeVisible()
    await expect(page.getByText('To buy', { exact: true })).toBeVisible()
  })

  test('splits a combined grocery contribution and keeps the correction after reload', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/lists$/)

    await page.goto('/lists/new')
    await page
      .getByRole('textbox', { name: 'List name' })
      .fill(`Split groceries ${Date.now()}`)
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)

    await page.getByRole('link', { name: 'Review at home' }).click()
    for (const [index, line] of ['2 cups onions', '1 cup onions'].entries()) {
      await page.getByLabel('Add a grocery item').fill(line)
      await page.getByRole('button', { name: 'Add item' }).click()
      await expect(
        page.getByLabel(`Manual grocery item ${index + 1}`),
      ).toBeVisible()
    }

    await page.getByText('View contributions').click()
    await page
      .getByRole('button', {
        name: 'Split 2 cups onions into separate grocery item',
      })
      .click()
    await expect(page.getByText('Split this contribution?')).toBeVisible()
    await page.getByRole('button', { name: 'Split item' }).click()

    await expect(
      page.getByRole('button', {
        name: 'Split 2 cups onions into separate grocery item',
      }),
    ).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('View contribution')).toHaveCount(2)
    await page.getByText('View contribution').nth(0).click()
    await page.getByText('View contribution').nth(1).click()
    await expect(page.getByText('2 cups onions')).toBeVisible()
    await expect(page.getByText('1 cup onions')).toBeVisible()
  })
})
