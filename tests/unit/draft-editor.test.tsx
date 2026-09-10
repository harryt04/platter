import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DraftEditor } from '@/components/recipes/draft-editor'

afterEach(() => cleanup())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('DraftEditor', () => {
  it('makes the title-only draft action and privacy state clear', () => {
    render(<DraftEditor />)

    expect(screen.getByRole('textbox', { name: 'Recipe title' })).toBeRequired()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    expect(screen.getByText(/A title alone stays a draft/)).toBeInTheDocument()
  })

  it('exposes yield and structured ingredient fields for an existing draft', () => {
    render(
      <DraftEditor
        recipeId="recipe-1"
        initialTitle="Tomato soup"
        initialTypicalPeopleFed={4}
        initialIngredients={[
          {
            originalText: '2 onions',
            quantity: '2',
            unit: 'each',
            ingredientName: 'Onions',
            preparationNote: '',
            optional: false,
          },
        ]}
      />,
    )

    expect(
      screen.getByRole('spinbutton', { name: 'Typical people fed' }),
    ).toHaveValue(4)
    expect(
      screen.getByRole('textbox', { name: 'Ingredient name' }),
    ).toHaveValue('Onions')
    expect(screen.getByRole('button', { name: 'Add ingredient' })).toBeEnabled()
  })
})
