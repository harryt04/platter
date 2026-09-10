import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecipeSharing } from '@/components/recipes/recipe-sharing'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RecipeSharing', () => {
  it('shares a usable authored recipe with the selected active lists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ visibility: 'list-shared', listIds: ['list-1'] }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <RecipeSharing
        recipeId="recipe-1"
        status="usable"
        origin="authored"
        visibility="private"
        lists={[
          { id: 'list-1', name: 'Family', status: 'active' },
          { id: 'list-2', name: 'Friends', status: 'active' },
        ]}
        initialSharedListIds={[]}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Family' }))
    await user.click(screen.getByRole('button', { name: 'Save sharing' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/recipes/recipe-1/shares',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ listIds: ['list-1'], publishPublic: false }),
      }),
    )
    expect(
      screen.getByText('This recipe is shared with the selected lists.'),
    ).toBeInTheDocument()
  })

  it('explains why an incomplete draft cannot be shared yet', () => {
    render(
      <RecipeSharing
        recipeId="recipe-1"
        status="draft"
        origin="authored"
        visibility="private"
        lists={[{ id: 'list-1', name: 'Family', status: 'active' }]}
        initialSharedListIds={[]}
      />,
    )

    expect(
      screen.getByText(/Complete this authored recipe with a yield/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save sharing' }),
    ).not.toBeInTheDocument()
  })
})
