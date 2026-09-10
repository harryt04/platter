import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import { GroceryRow } from '@/components/patterns/grocery-row'
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

  it('labels a low-confidence item with an optional comparison suggestion', () => {
    const first: GroceryItem = {
      id: 'grocery:recipe:first:0',
      ingredientName: 'onions',
      normalizedIdentity: 'onions',
      dimension: 'count',
      unit: { name: 'each', dimension: 'count' },
      calculatedRequirement: null,
      shoppingAmount: null,
      contributions: [
        {
          id: 'recipe:first:0',
          source: {
            kind: 'recipe',
            selectionId: 'first',
            recipeId: 'recipe-first',
            versionId: 'version-first',
            recipeTitle: 'Tacos',
          },
          originalText: 'some onions',
          ingredientName: 'onions',
          normalizedIdentity: 'onions',
          parserConfidence: 'low',
          unit: { name: 'each', dimension: 'count' },
          optional: false,
          calculatedQuantity: null,
        },
      ],
    }
    const second = {
      ...first,
      id: 'grocery:recipe:second:0',
      ingredientName: 'onion',
      contributions: [
        {
          ...first.contributions[0]!,
          id: 'recipe:second:0',
          source: {
            kind: 'recipe' as const,
            selectionId: 'second',
            recipeId: 'recipe-second',
            versionId: 'version-second',
            recipeTitle: 'Curry',
          },
          originalText: '1 onion',
          ingredientName: 'onion',
          calculatedQuantity: { min: '1' },
        },
      ],
      calculatedRequirement: { min: '1' },
      shoppingAmount: { min: '1' },
    } satisfies GroceryItem

    render(
      <GroceryRow
        item={first}
        mergeSuggestions={[{ id: 'suggestion-1', left: first, right: second }]}
      />,
    )

    expect(screen.getByText('Possible match')).toBeInTheDocument()
    expect(
      screen.getByText(/may match 1 each onion from Curry/),
    ).toBeInTheDocument()
    expect(screen.getByText(/stays separate/)).toBeInTheDocument()
    expect(screen.getByText('Compare possible match')).toBeInTheDocument()
    const comparison = screen.getByLabelText('Possible merge comparison')
    expect(comparison).toBeInTheDocument()
    expect(
      within(comparison).getByText('This item: onions'),
    ).toBeInTheDocument()
    expect(
      within(comparison).getByText('Possible match: onion'),
    ).toBeInTheDocument()
    expect(within(comparison).getAllByText('onions')).toHaveLength(2)
    expect(within(comparison).getAllByText('count')).toHaveLength(2)
    expect(
      within(comparison).getByText('Recipe contribution · Tacos'),
    ).toBeInTheDocument()
    expect(
      within(comparison).getByText('Recipe contribution · Curry'),
    ).toBeInTheDocument()
    expect(within(comparison).getByText('some onions')).toBeInTheDocument()
    expect(within(comparison).getByText('1 onion')).toBeInTheDocument()
  })
})
