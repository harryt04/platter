import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeleteDraftButton } from '@/components/recipes/delete-draft-button'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

afterEach(() => cleanup())

describe('DeleteDraftButton', () => {
  it('explains list impact and immutable-reference preservation', async () => {
    const user = userEvent.setup()
    render(
      <DeleteDraftButton
        recipeId="recipe-1"
        sharedListNames={['Family', 'Weeknight']}
        title="Tomato soup"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      screen.getByText(
        'This removes the recipe from Family, Weeknight for its members. Any existing shopping or history reference keeps its pinned immutable recipe version.',
      ),
    ).toBeInTheDocument()
  })
})
