import { describe, expect, it } from 'vitest'
import {
  formatIngredientQuantity,
  ingredientUnitForDisplay,
} from '@/lib/recipes/unit-presentation'

describe('locale-aware ingredient presentation', () => {
  it('presents mass in metric units without mutating the stored quantity', () => {
    const quantity = { min: '2' }

    expect(
      formatIngredientQuantity(
        quantity,
        { name: 'lb', dimension: 'mass' },
        'de-DE',
      ),
    ).toBe('907,18 g')
    expect(quantity).toEqual({ min: '2' })
  })

  it('presents mass and volume in US units for an English US profile', () => {
    expect(
      formatIngredientQuantity(
        { min: '1000' },
        { name: 'g', dimension: 'mass' },
        'en-US',
      ),
    ).toBe('2.2 lb')
    expect(
      formatIngredientQuantity(
        { min: '500' },
        { name: 'ml', dimension: 'volume' },
        'en-US',
      ),
    ).toBe('2.11 cup')
  })

  it('keeps count and unknown units readable without inventing conversions', () => {
    expect(
      formatIngredientQuantity(
        { min: '3' },
        { name: 'each', dimension: 'count' },
        'fr-FR',
      ),
    ).toBe('3 each')
    expect(ingredientUnitForDisplay('tbsp')).toEqual({
      name: 'tbsp',
      dimension: 'volume',
    })
  })
})
