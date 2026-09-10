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
    await expect(page).toHaveURL(/\/lists\/[^/]+$/)

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

  test('checks and unchecks a grocery item independently while shopping', async ({
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

    const markPurchased = page.getByRole('button', {
      name: 'Mark spinach purchased',
    })
    await expect(markPurchased).toBeVisible()
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
