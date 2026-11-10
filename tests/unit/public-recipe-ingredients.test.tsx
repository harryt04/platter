import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PublicRecipeIngredients } from '@/components/recipes/public-recipe-ingredients'

afterEach(() => cleanup())

describe('PublicRecipeIngredients', () => {
  it('uses data typography for quantities and keeps preparation details readable', () => {
    render(
      <PublicRecipeIngredients
        ingredients={[
          {
            originalText: '2 cups diced tomatoes',
            quantity: '2',
            unit: 'cups',
            ingredientName: 'tomatoes',
            preparationNote: 'diced',
            optional: false,
          },
        ]}
      />,
    )

    expect(screen.getByText('2 cups')).toHaveClass('font-data')
    expect(screen.getByText('tomatoes, diced')).toBeInTheDocument()
  })

  it('labels an ingredient without a quantity honestly', () => {
    render(
      <PublicRecipeIngredients
        ingredients={[
          {
            originalText: 'Salt to taste',
            ingredientName: 'salt',
            optional: false,
          },
        ]}
      />,
    )

    expect(screen.getByText('As needed')).toHaveClass('font-data')
  })
})
