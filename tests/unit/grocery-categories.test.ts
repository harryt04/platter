import { describe, expect, it } from 'vitest'
import {
  defaultGroceryCategory,
  groceryCategoryDefinitions,
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
})
