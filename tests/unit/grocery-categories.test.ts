import { describe, expect, it } from 'vitest'
import {
  defaultGroceryCategoryOrder,
  defaultGroceryCategory,
  groupGroceryItemsByDefaultCategory,
  groupGroceryItemsByCategoryOrder,
  groceryCategoryDefinitions,
  sortGroceryItemsByDefaultOrder,
} from '@/lib/recipes/grocery-categories'

describe('default grocery categories', () => {
  it('documents every supported category and falls back to Other', () => {
    expect(groceryCategoryDefinitions.other.label).toBe('Other')
    expect(
      defaultGroceryCategory({
        ingredientName: 'mystery ingredient',
        parserConfidence: 'high',
      }),
    ).toBe('other')
  })

  it.each([
    ['onions', 'produce'],
    ['chicken breast', 'meat-seafood'],
    ['cheddar cheese', 'dairy-eggs'],
    ['rice', 'pantry'],
    ['flour', 'baking'],
    ['paper towels', 'household'],
    ['coffee', 'beverages'],
  ] as const)('categorizes %s as %s', (ingredientName, category) => {
    expect(defaultGroceryCategory({ ingredientName })).toBe(category)
  })

  it('uses source wording to identify canned goods', () => {
    expect(
      defaultGroceryCategory({
        ingredientName: 'tomatoes',
        normalizedIdentity: 'tomatoes',
        originalTexts: ['1 can tomatoes'],
      }),
    ).toBe('canned-goods')
  })

  it('keeps uncertain parser output in Other', () => {
    expect(
      defaultGroceryCategory({
        ingredientName: 'onions',
        parserConfidence: 'low',
      }),
    ).toBe('other')
  })

  it('uses the documented store route and deterministic item tie-breakers', () => {
    const items = [
      { id: 'zeta', category: 'other' as const, ingredientName: 'Zucchini' },
      { id: 'onion-b', category: 'produce' as const, ingredientName: 'Onion' },
      { id: 'flour', category: 'baking' as const, ingredientName: 'Flour' },
      { id: 'onion-a', category: 'produce' as const, ingredientName: 'onion' },
      { id: 'apple', category: 'produce' as const, ingredientName: 'Apple' },
      { id: 'milk', category: 'dairy-eggs' as const, ingredientName: 'Milk' },
    ]

    expect(defaultGroceryCategoryOrder).toEqual([
      'produce',
      'meat-seafood',
      'dairy-eggs',
      'bakery',
      'pantry',
      'canned-goods',
      'frozen',
      'beverages',
      'baking',
      'household',
      'other',
    ])
    expect(
      sortGroceryItemsByDefaultOrder(items).map((item) => item.id),
    ).toEqual(['apple', 'onion-a', 'onion-b', 'milk', 'flour', 'zeta'])
    expect(
      groupGroceryItemsByDefaultCategory(items).map(({ category, items }) => ({
        category,
        itemIds: items.map((item) => item.id),
      })),
    ).toEqual([
      { category: 'produce', itemIds: ['apple', 'onion-a', 'onion-b'] },
      { category: 'dairy-eggs', itemIds: ['milk'] },
      { category: 'baking', itemIds: ['flour'] },
      { category: 'other', itemIds: ['zeta'] },
    ])
  })

  it('uses a current-run item order only within its existing category', () => {
    const items = [
      { id: 'apple', category: 'produce' as const, ingredientName: 'Apple' },
      { id: 'onion', category: 'produce' as const, ingredientName: 'Onion' },
      { id: 'milk', category: 'dairy-eggs' as const, ingredientName: 'Milk' },
    ]

    expect(
      groupGroceryItemsByCategoryOrder(items, [
        'onion',
        'missing',
        'apple',
      ]).map(({ category, items }) => ({
        category,
        ids: items.map(({ id }) => id),
      })),
    ).toEqual([
      { category: 'produce', ids: ['onion', 'apple'] },
      { category: 'dairy-eggs', ids: ['milk'] },
    ])
  })
})
