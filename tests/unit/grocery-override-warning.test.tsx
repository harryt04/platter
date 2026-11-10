import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GroceryOverrideWarning } from '@/components/patterns/grocery-override-warning'
import type { GroceryItem } from '@/lib/recipes/groceries'

const item: GroceryItem = {
  id: 'grocery:merged:rice:mass:lb',
  ingredientName: 'rice',
  category: 'pantry',
  normalizedIdentity: 'rice',
  dimension: 'mass',
  unit: { name: 'lb', dimension: 'mass' },
  calculatedRequirement: { min: '3' },
  shoppingAmount: { min: '5.25' },
  override: { min: '5.25' },
  overrideWarning: {
    previousCalculatedRequirement: { min: '2' },
    currentCalculatedRequirement: { min: '3' },
  },
  contributions: [],
}

describe('GroceryOverrideWarning', () => {
  afterEach(cleanup)

  it('states the intended amount and both calculated requirements', () => {
    render(<GroceryOverrideWarning item={item} />)

    const warning = screen.getByRole('alert')
    expect(warning).toHaveClass('text-warning')
    expect(warning).not.toHaveClass('text-warning-foreground')
    expect(warning).toHaveTextContent(
      'Your intended shopping amount remains 5.25 lb. The calculated requirement changed from 2 lb to 3 lb.',
    )
  })

  it('does not render when the calculation has not changed', () => {
    render(
      <GroceryOverrideWarning item={{ ...item, overrideWarning: undefined }} />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
