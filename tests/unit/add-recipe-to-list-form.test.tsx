import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddRecipeToListForm } from '@/components/recipes/add-recipe-to-list-form'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('AddRecipeToListForm', () => {
  it('requires an explicit action and submits precise four-to-two and four-to-six selections', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ selection: { scaleFactor: '0.5' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ selection: { scaleFactor: '1.5' } }),
        }),
    )
    const user = userEvent.setup()
    render(
      <AddRecipeToListForm
        defaultPeople={4}
        lists={[
          { id: 'list-two', name: 'Two people' },
          { id: 'list-six', name: 'Six people' },
        ]}
        recipeId="recipe-1"
        recipeTitle="Tomato soup"
      />,
    )

    expect(fetch).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Add to this week' }),
    ).toBeInTheDocument()

    const people = screen.getByLabelText('People')
    await user.clear(people)
    await user.type(people, '2')
    await user.click(screen.getByRole('button', { name: 'Add to this week' }))

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/lists/list-two/selections',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 2 }),
      }),
    )
    expect(await screen.findByText(/scale 0\.5/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('List'), 'list-six')
    await user.clear(people)
    await user.type(people, '6')
    await user.click(screen.getByRole('button', { name: 'Add to this week' }))

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/lists/list-six/selections',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 6 }),
      }),
    )
    expect(await screen.findByText(/scale 1\.5/)).toBeInTheDocument()
  })
})
