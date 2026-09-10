import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecipeImportPreview } from '@/components/recipes/recipe-import-preview'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const candidate = {
  title: 'Imported soup',
  typicalPeopleFed: 4,
  ingredients: [
    {
      originalText: '1 cup carrots',
      quantity: '1',
      unit: 'cup',
      ingredientName: 'carrots',
      optional: false,
    },
  ],
  instructions: ['Simmer.'],
  sourceName: 'Example Recipes',
  sourceUrl: 'https://example.com/recipe',
  warnings: ['The source did not provide a single whole-number yield.'],
}

describe('RecipeImportPreview', () => {
  it('renders editable recipe structure, source facts, warnings, and no-run copy', () => {
    render(
      <RecipeImportPreview
        candidate={candidate}
        importId="b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7"
      />,
    )

    expect(screen.getByLabelText('Recipe title')).toHaveValue('Imported soup')
    expect(screen.getByLabelText('Typical people fed')).toHaveValue(4)
    expect(screen.getByLabelText('Ingredient name')).toHaveValue('carrots')
    expect(screen.getByLabelText('Instruction 1')).toHaveValue('Simmer.')
    expect(screen.getByLabelText('Source name')).toHaveValue('Example Recipes')
    expect(
      screen.getByText(/saving creates a private imported draft/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/will not add anything to an active shopping run/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/single whole-number yield/i)).toBeInTheDocument()
  })

  it('supports correcting and reordering the preview before saving', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ recipe: { id: 'recipe-1' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    render(
      <RecipeImportPreview
        candidate={{
          ...candidate,
          instructions: ['First.', 'Second.'],
        }}
        importId="b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7"
      />,
    )

    fireEvent.change(screen.getByLabelText('Recipe title'), {
      target: { value: 'Corrected soup' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Move instruction 2 up' }),
    )
    expect(screen.getByLabelText('Instruction 1')).toHaveValue('Second.')
    fireEvent.click(
      screen.getByRole('button', { name: 'Save private recipe draft' }),
    )

    return vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/imports/b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7/save',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(push).toHaveBeenCalledWith('/recipes/recipe-1/edit')
      fetchMock.mockRestore()
    })
  })

  it('keeps partial imports in a prefilled manual editor', () => {
    render(
      <RecipeImportPreview
        candidate={{
          ingredients: [],
          instructions: [],
          sourceUrl: candidate.sourceUrl,
          sourceName: candidate.sourceName,
          cuisine: 'Mediterranean',
          warnings: [
            'The source did not provide a usable title.',
            'The source did not provide structured ingredients.',
            'The source did not provide structured instructions.',
          ],
        }}
        importId="b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7"
      />,
    )

    expect(
      screen.getByText(/preserved the safe recipe facts/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/no ingredients were extracted/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/no instructions were extracted/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Source name')).toHaveValue('Example Recipes')
    expect(screen.getByLabelText('Cuisine')).toHaveValue('Mediterranean')

    fireEvent.click(screen.getByRole('button', { name: 'Add ingredient' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add instruction' }))

    expect(screen.getByLabelText('Ingredient name')).toHaveValue('')
    expect(screen.getByLabelText('Instruction 1')).toHaveValue('')
  })

  it('links to an existing public recipe when the save is a duplicate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'A public recipe from this source already exists.',
          existingRecipe: { id: 'existing-recipe', title: 'Existing soup' },
        }),
        {
          status: 409,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    )
    render(
      <RecipeImportPreview
        candidate={candidate}
        importId="b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Save private recipe draft' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /public recipe from this source already exists/i,
    )
    expect(
      screen.getByRole('link', { name: 'Open existing recipe' }),
    ).toHaveAttribute('href', '/recipes/existing-recipe')
  })

  it('requires confirmation before saving a changed source version', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: 'Confirm the related source version.',
          relatedRecipe: {
            id: 'existing-recipe',
            title: 'Existing soup',
            versionNumber: 2,
            sourceUrl: 'https://example.com/recipe',
          },
        }),
        { status: 409 },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ recipe: { id: 'updated-recipe' } }), {
        status: 201,
      }),
    )
    render(
      <RecipeImportPreview
        candidate={candidate}
        importId="b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Save private recipe draft' }),
    )
    expect(
      await screen.findByText('This source has changed'),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm related source version' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save related source version' }),
    )

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(
        JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
      ).toMatchObject({ acceptRelatedVersion: true })
      expect(push).toHaveBeenCalledWith('/recipes/updated-recipe/edit')
    })
  })
})
