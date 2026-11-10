import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
        initialPrepTimeMinutes={15}
        initialCookingTimeMinutes={30}
        initialTotalTimeMinutes={45}
        initialCuisine="Mediterranean"
        initialMealType="Dinner"
        initialHouseholdNotes="Use less salt for the kids."
        initialSourceName="Neighborhood cookbook"
        initialSourceUrl="https://example.com/recipe"
        initialSourceAuthor="Alex Rivera"
        initialAttribution="Adapted with permission."
        initialImage={{
          url: 'https://images.example.com/soup.jpg',
          altText: 'Tomato soup with herbs',
          sourceName: 'My kitchen',
          sourceUrl: 'https://example.com/image',
          creator: 'Alex Rivera',
          license: 'Personal permission',
          rightsStatus: 'permission-granted',
        }}
        initialNutrition={{
          calories: 420,
          proteinGrams: 18.5,
          sodiumMilligrams: 640,
        }}
        initialTags={['weeknight', 'make ahead']}
        initialDietaryLabels={['vegetarian']}
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
      screen.getByRole('spinbutton', { name: 'Prep time (minutes)' }),
    ).toHaveValue(15)
    expect(
      screen.getByRole('spinbutton', { name: 'Cooking time (minutes)' }),
    ).toHaveValue(30)
    expect(
      screen.getByRole('spinbutton', { name: 'Total time (minutes)' }),
    ).toHaveValue(45)
    expect(screen.getByRole('textbox', { name: 'Cuisine' })).toHaveValue(
      'Mediterranean',
    )
    expect(screen.getByRole('textbox', { name: 'Meal type' })).toHaveValue(
      'Dinner',
    )
    expect(
      screen.getByRole('textbox', { name: /Household notes/ }),
    ).toHaveValue('Use less salt for the kids.')
    expect(screen.getByRole('textbox', { name: /Source name/ })).toHaveValue(
      'Neighborhood cookbook',
    )
    expect(screen.getByRole('textbox', { name: /Source URL/ })).toHaveValue(
      'https://example.com/recipe',
    )
    expect(screen.getByRole('textbox', { name: /Source author/ })).toHaveValue(
      'Alex Rivera',
    )
    expect(screen.getByRole('textbox', { name: /Attribution/ })).toHaveValue(
      'Adapted with permission.',
    )
    expect(screen.getByRole('textbox', { name: 'Image URL' })).toHaveValue(
      'https://images.example.com/soup.jpg',
    )
    expect(
      screen.getByRole('textbox', { name: /Image description/ }),
    ).toHaveValue('Tomato soup with herbs')
    expect(
      screen.getByRole('textbox', { name: /Image source name/ }),
    ).toHaveValue('My kitchen')
    expect(screen.getByRole('textbox', { name: /Image creator/ })).toHaveValue(
      'Alex Rivera',
    )
    expect(
      screen.getByRole('textbox', { name: /Image source URL/ }),
    ).toHaveValue('https://example.com/image')
    expect(
      screen.getByRole('textbox', { name: /License or permission/ }),
    ).toHaveValue('Personal permission')
    expect(
      screen.getByRole('combobox', { name: 'Image rights status' }),
    ).toHaveValue('permission-granted')
    expect(screen.getByRole('textbox', { name: 'Tags' })).toHaveValue(
      'weeknight, make ahead',
    )
    expect(screen.getByRole('textbox', { name: 'Dietary labels' })).toHaveValue(
      'vegetarian',
    )
    expect(
      screen.getByRole('spinbutton', { name: 'Calories (kcal)' }),
    ).toHaveValue(420)
    expect(screen.getByRole('spinbutton', { name: 'Protein (g)' })).toHaveValue(
      18.5,
    )
    expect(screen.getByRole('spinbutton', { name: 'Sodium (mg)' })).toHaveValue(
      640,
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

    await user.click(screen.getByRole('button', { name: 'Remove step 3' }))
    expect(
      screen.queryByRole('textbox', { name: 'Instruction 3' }),
    ).not.toBeInTheDocument()
  })

  it('restores focus to the moved recipe step after keyboard reordering', async () => {
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

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Move step 2 up' }),
      ).toHaveFocus(),
    )
  })

  it('restores focus to the next recipe item after keyboard removal', async () => {
    const user = userEvent.setup()
    render(
      <DraftEditor
        recipeId="recipe-1"
        initialTitle="Tomato soup"
        initialInstructions={['Warm the pan.', 'Add the onions.']}
      />,
    )

    const removeFirst = screen.getByRole('button', { name: 'Remove step 1' })
    removeFirst.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove step 1' }),
      ).toHaveFocus(),
    )
  })

  it('requires confirmation before saving an ingredient correction as a new version', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ recipe: { id: 'recipe-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DraftEditor
        recipeId="recipe-1"
        initialTitle="Tomato soup"
        initialIngredients={[
          {
            originalText: '2 onions',
            quantity: '2',
            unit: 'each',
            ingredientName: 'Onions',
            optional: false,
          },
        ]}
      />,
    )

    await user.clear(screen.getByRole('textbox', { name: 'Ingredient name' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ingredient name' }),
      'Red onions',
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole('alertdialog', { name: 'Apply ingredient correction?' }),
    ).toHaveTextContent(/saves a new recipe version/i)
    expect(
      screen.getByText(/stay pinned to their current version/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save new version' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/recipes/recipe-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Red onions'),
      }),
    )
  })
})
