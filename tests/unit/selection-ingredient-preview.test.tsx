import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SelectionIngredientPreview } from '@/components/recipes/selection-ingredient-preview'

afterEach(() => cleanup())

describe('SelectionIngredientPreview', () => {
  it('keeps missing quantities honest and labels optional ingredients', () => {
    render(
      <SelectionIngredientPreview
        ingredients={[
          {
            ingredientName: 'salt',
            optional: true,
            calculatedQuantity: null,
          },
          {
            ingredientName: 'onions',
            unit: 'each',
            optional: false,
            calculatedQuantity: { min: '3' },
          },
        ]}
      />,
    )

    expect(screen.getByText('As needed')).toHaveClass('font-data')
    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.getByText('3 each')).toHaveClass('font-data')
    expect(screen.getByText(/without an invented amount/)).toBeInTheDocument()
  })

  it('renders ranges without changing their precise values', () => {
    render(
      <SelectionIngredientPreview
        ingredients={[
          {
            ingredientName: 'flour',
            unit: 'cup',
            optional: false,
            calculatedQuantity: {
              min: '1.3333333333333333333333333333333333333333',
              max: '2.5',
            },
          },
        ]}
      />,
    )

    expect(
      screen.getByText('1.3333333333333333333333333333333333333333–2.5 cup'),
    ).toBeInTheDocument()
  })
})
