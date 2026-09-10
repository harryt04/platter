import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SavePublicRecipeButton } from '@/components/recipes/save-public-recipe-button'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SavePublicRecipeButton', () => {
  it('saves a recipe and exposes the saved state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const user = userEvent.setup()
    render(<SavePublicRecipeButton initialSaved={false} recipeId="recipe-1" />)

    await user.click(screen.getByRole('button', { name: 'Save to my recipes' }))

    expect(fetch).toHaveBeenCalledWith('/api/v1/recipes/recipe-1/save', {
      method: 'POST',
    })
    expect(
      screen.getByRole('button', { name: 'Saved to my recipes' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByText(
        'Available in your recipe library without adding it to a shopping run.',
      ),
    ).toBeInTheDocument()
  })

  it('removes an existing save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const user = userEvent.setup()
    render(<SavePublicRecipeButton initialSaved recipeId="recipe-1" />)

    await user.click(
      screen.getByRole('button', { name: 'Saved to my recipes' }),
    )

    expect(fetch).toHaveBeenCalledWith('/api/v1/recipes/recipe-1/save', {
      method: 'DELETE',
    })
    expect(
      screen.getByRole('button', { name: 'Save to my recipes' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })
})
