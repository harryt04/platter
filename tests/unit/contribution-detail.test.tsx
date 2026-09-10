import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import type { GroceryItem } from '@/lib/recipes/groceries'

afterEach(() => cleanup())

const item: GroceryItem = {
  id: 'grocery:merged:onions:volume:cup',
  ingredientName: 'onions',
  normalizedIdentity: 'onions',
  dimension: 'volume',
  unit: { name: 'cup', dimension: 'volume' },
  calculatedRequirement: { min: '4' },
  shoppingAmount: { min: '4' },
  contributions: [
    {
      id: 'recipe:tacos:0',
      source: {
        kind: 'recipe',
        selectionId: 'tacos',
        recipeId: 'recipe-tacos',
        versionId: 'version-tacos',
        recipeTitle: 'Tacos',
      },
      originalText: '1 cup onions',
      ingredientName: 'onions',
      normalizedIdentity: 'onions',
      parserConfidence: 'high',
      unit: { name: 'cup', dimension: 'volume' },
      optional: false,
      calculatedQuantity: { min: '1' },
    },
    {
      id: 'manual:extra',
      source: { kind: 'manual', additionId: 'extra' },
      originalText: '3 tbsp onions',
      ingredientName: 'onions',
      normalizedIdentity: 'onions',
      parserConfidence: 'high',
      unit: { name: 'tbsp', dimension: 'volume' },
      optional: true,
      calculatedQuantity: { min: '3' },
    },
  ],
}

describe('ContributionDetail', () => {
  it('exposes each source contribution and the calculated requirement', () => {
    render(<ContributionDetail item={item} />)

    expect(screen.getByText('View contributions')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText('Manual grocery item')).toBeInTheDocument()
    expect(screen.getByText('1 cup')).toBeInTheDocument()
    expect(screen.getByText('3 tbsp')).toBeInTheDocument()
    expect(screen.getByText('1 cup onions')).toBeInTheDocument()
    expect(screen.getByText('3 tbsp onions · Optional')).toBeInTheDocument()
    expect(screen.getByText('4 cup')).toBeInTheDocument()
  })

  it('keeps an unquantified contribution readable without inventing a total', () => {
    render(
      <ContributionDetail
        item={{
          ...item,
          calculatedRequirement: null,
          shoppingAmount: null,
          contributions: [
            { ...item.contributions[0]!, calculatedQuantity: null },
          ],
        }}
      />,
    )

    expect(screen.getAllByText('As needed')).toHaveLength(2)
  })
})
