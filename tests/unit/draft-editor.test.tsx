import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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
        initialDescription="A comforting weeknight soup."
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
        initialInstructions={['Warm the pan.', 'Add the onions.']}
      />,
    )

    expect(
      screen.getByRole('spinbutton', { name: 'Typical people fed' }),
    ).toHaveValue(4)
    expect(screen.getByRole('textbox', { name: /Description/ })).toHaveValue(
      'A comforting weeknight soup.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Ingredient name' }),
    ).toHaveValue('Onions')
    expect(screen.getByRole('button', { name: 'Add ingredient' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Instruction 1' })).toHaveValue(
      'Warm the pan.',
    )
    expect(
      screen.getByRole('button', { name: 'Move step 1 up' }),
    ).toBeDisabled()
  })

  it('supports keyboard-friendly step ordering and editing controls', async () => {
    const user = userEvent.setup()
    render(
      <DraftEditor
        recipeId="recipe-1"
        initialTitle="Tomato soup"
        initialInstructions={['Warm the pan.', 'Add the onions.']}
      />,
    )

    const moveDown = screen.getByRole('button', {
      name: 'Move step 1 down',
    })
    moveDown.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: 'Instruction 1' })).toHaveValue(
      'Add the onions.',
    )
    expect(screen.getByRole('textbox', { name: 'Instruction 2' })).toHaveValue(
      'Warm the pan.',
    )

    await user.click(screen.getByRole('button', { name: 'Add instruction' }))
    const newInstruction = screen.getByRole('textbox', {
      name: 'Instruction 3',
    })
    await user.type(newInstruction, 'Finish with herbs.')
    expect(newInstruction).toHaveValue('Finish with herbs.')

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[2])
    expect(
      screen.queryByRole('textbox', { name: 'Instruction 3' }),
    ).not.toBeInTheDocument()
  })
})
