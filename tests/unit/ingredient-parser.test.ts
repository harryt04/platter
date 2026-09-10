import { describe, expect, it } from 'vitest'
import { parseIngredientLine } from '@/lib/recipes/ingredient-parser'

describe('ingredient line parser', () => {
  it.each([
    {
      line: '1 1/2 cups flour',
      quantity: { min: '1.5' },
      unit: { name: 'cup', dimension: 'volume' },
      ingredientName: 'flour',
    },
    {
      line: '½ cup finely chopped parsley',
      quantity: { min: '0.5' },
      unit: { name: 'cup', dimension: 'volume' },
      ingredientName: 'finely chopped parsley',
    },
    {
      line: '2–3 cloves garlic, minced',
      quantity: { min: '2', max: '3' },
      unit: { name: 'clove', dimension: 'count' },
      ingredientName: 'garlic',
      preparationNote: 'minced',
    },
  ])('parses $line', ({ line, ...expected }) => {
    expect(parseIngredientLine(line)).toMatchObject(expected)
  })

  it('recognizes a word range and keeps count ingredients distinct', () => {
    expect(parseIngredientLine('2 to 4 yellow onions')).toMatchObject({
      quantity: { min: '2', max: '4' },
      unit: { name: 'each', dimension: 'count' },
      ingredientName: 'yellow onions',
    })
  })

  it('degrades missing quantities to a readable ingredient', () => {
    expect(parseIngredientLine('salt, to taste')).toMatchObject({
      quantity: null,
      unit: { name: 'unknown', dimension: 'unknown' },
      ingredientName: 'salt',
      preparationNote: 'to taste',
    })
  })

  it.each([
    {
      line: '1 (15-ounce) can diced tomatoes',
      packageSize: {
        quantity: { min: '15' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'diced tomatoes',
      unit: { name: 'can', dimension: 'count' },
    },
    {
      line: '2 x 14 oz cans beans',
      packageSize: {
        quantity: { min: '14' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'beans',
      unit: { name: 'can', dimension: 'count' },
    },
    {
      line: '1 can (15 oz) tomatoes',
      packageSize: {
        quantity: { min: '15' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'tomatoes',
      unit: { name: 'can', dimension: 'count' },
    },
    {
      line: '2 14-ounce cans chickpeas',
      packageSize: {
        quantity: { min: '14' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'chickpeas',
      unit: { name: 'can', dimension: 'count' },
    },
  ])('preserves package size for $line', ({ line, ...expected }) => {
    expect(parseIngredientLine(line)).toMatchObject(expected)
  })

  it('marks optional ingredients without losing their name or preparation', () => {
    expect(
      parseIngredientLine('1 tbsp olive oil (optional), for frying'),
    ).toMatchObject({
      quantity: { min: '1' },
      unit: { name: 'tbsp', dimension: 'volume' },
      ingredientName: 'olive oil',
      preparationNote: 'for frying',
      optional: true,
    })
  })

  it('preserves sanitized source text for correction and display', () => {
    expect(parseIngredientLine('  2 eggs\u0000  ')).toMatchObject({
      originalText: '2 eggs',
      quantity: { min: '2' },
      ingredientName: 'eggs',
    })
  })

  it('retains calculation precision and degrades malformed quantities safely', () => {
    expect(parseIngredientLine('1/3 cup sugar').quantity).toEqual({
      min: '0.33333333333333333333',
    })
    expect(parseIngredientLine('1/0 cup sugar')).toMatchObject({
      quantity: null,
      ingredientName: '1/0 cup sugar',
    })
  })
})
