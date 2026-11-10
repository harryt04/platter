import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const recipeId = process.env.E2E_PUBLIC_RECIPE_ID
const unavailableImageRecipeId =
  process.env.E2E_PUBLIC_RECIPE_UNAVAILABLE_IMAGE_ID
const minimalRecipeId = process.env.E2E_PUBLIC_RECIPE_MINIMAL_ID

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([])
}

test.describe('public recipe detail', () => {
  test.skip(
    !recipeId,
    'Set E2E_PUBLIC_RECIPE_ID to a public usable recipe for detail-page browser coverage.',
  )

  test('keeps the recipe detail readable without horizontal scrolling', async ({
    page,
  }) => {
    await page.goto(`/recipes/${recipeId}`)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(
      page.getByRole('heading', { name: 'Ingredients' }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Recipe provenance' }),
    ).toBeVisible()

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

  test('@a11y exposes one heading and no serious or critical violations', async ({
    page,
  }) => {
    await page.goto(`/recipes/${recipeId}`)
    expect(await page.locator('h1').count()).toBe(1)

    await expectAccessible(page)
  })

  test('fits a 320px viewport without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 320 })
    await page.goto(`/recipes/${recipeId}`)

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})

test.describe('public recipe detail states', () => {
  test.skip(
    !unavailableImageRecipeId,
    'Set E2E_PUBLIC_RECIPE_UNAVAILABLE_IMAGE_ID to a public recipe with non-permitted image rights.',
  )

  test('@a11y explains when an image cannot be shown', async ({ page }) => {
    await page.goto(`/recipes/${unavailableImageRecipeId}`)
    await expect(
      page.getByText(
        'This source does not permit an image here. The recipe link is still available.',
      ),
    ).toBeVisible()
    await expectAccessible(page)
  })

  test.skip(
    !minimalRecipeId,
    'Set E2E_PUBLIC_RECIPE_MINIMAL_ID to a public recipe without optional detail metadata.',
  )

  test('@a11y labels missing optional recipe details honestly', async ({
    page,
  }) => {
    await page.goto(`/recipes/${minimalRecipeId}`)
    await expect(page.getByText('Typical yield not provided')).toBeVisible()
    await expect(
      page.getByText('Directions have not been added yet.'),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Recipe provenance' }),
    ).toContainText('Platter community')
    await expect(page.getByText('Attribution', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Image rights', { exact: true })).toHaveCount(0)
    await expectAccessible(page)
  })
})
