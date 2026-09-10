import { describe, expect, it } from 'vitest'
import { decimalString } from '@/lib/contracts/ids'
import {
  generateGroceryItems,
  type GroceryRecipeSelection,
} from '@/lib/recipes/groceries'

const ingredient = (
  overrides: Partial<{
    originalText: string
    quantity: string
    unit: string
    ingredientName: string
    normalizedIdentity: string
    parserConfidence: 'high' | 'medium' | 'low'
    preparationNote: string
    optional: boolean
  }> = {},
) => ({
  originalText: overrides.originalText ?? '2 cups onions',
  quantity: overrides.quantity ?? '2',
  unit: overrides.unit ?? 'cup',
  ingredientName: overrides.ingredientName ?? 'onions',
  ...(overrides.normalizedIdentity
    ? { normalizedIdentity: overrides.normalizedIdentity }
    : {}),
  ...(overrides.parserConfidence
    ? { parserConfidence: overrides.parserConfidence }
    : {}),
  ...(overrides.preparationNote
    ? { preparationNote: overrides.preparationNote }
    : {}),
  optional: overrides.optional ?? false,
})

const selection = (
  id: string,
  title: string,
  scaleFactor: string,
  ingredients: ReturnType<typeof ingredient>[],
): GroceryRecipeSelection => ({
  selection: {
    _id: id,
    recipeId: `recipe-${id}`,
    versionId: `version-${id}`,
    scaleFactor: decimalString(scaleFactor),
  },
  version: {
    _id: `version-${id}`,
    recipeId: `recipe-${id}`,
    versionNumber: 1,
    title,
    ingredients,
  },
})

describe('grocery generation', () => {
  it('is deterministic and preserves scaled recipe provenance when merging', () => {
    const input = {
      selections: [
        selection('b', 'Curry', '1.5', [
          ingredient({
            originalText: '2 cups green onions',
            ingredientName: 'green onions',
          }),
        ]),
        selection('a', 'Tacos', '0.5', [
          ingredient({
            originalText: '2 cups scallions',
            ingredientName: 'scallions',
          }),
        ]),
      ],
    }

    const first = generateGroceryItems(input)
    const second = generateGroceryItems(input)

    expect(first).toEqual(second)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      id: 'grocery:merged:green onions:volume:cup',
      ingredientName: 'green onions',
      calculatedRequirement: { min: '4' },
      shoppingAmount: { min: '4' },
      contributions: [
        {
          id: 'recipe:a:0',
          source: { kind: 'recipe', recipeTitle: 'Tacos' },
          calculatedQuantity: { min: '1' },
        },
        {
          id: 'recipe:b:0',
          source: { kind: 'recipe', recipeTitle: 'Curry' },
          calculatedQuantity: { min: '3' },
        },
      ],
    })
  })

  it('keeps uncertain identities, incompatible units, and missing amounts separate', () => {
    const items = generateGroceryItems({
      selections: [
        selection('medium', 'Medium', '1', [
          ingredient({
            originalText: '2 onions',
            quantity: '2',
            unit: '',
            ingredientName: 'onions',
          }),
        ]),
        selection('low', 'Low', '1', [
          ingredient({
            originalText: 'salt to taste',
            quantity: '',
            unit: '',
            ingredientName: 'salt',
          }),
        ]),
        selection('cup', 'Cup', '1', [ingredient()]),
        selection('tbsp', 'Tablespoon', '1', [
          ingredient({
            originalText: '2 tbsp onions',
            quantity: '2',
            unit: 'tbsp',
          }),
        ]),
      ],
    })

    expect(items).toHaveLength(4)
    expect(
      items.filter((item) => item.normalizedIdentity === 'onions'),
    ).toHaveLength(3)
    expect(items.find((item) => item.ingredientName === 'salt')).toMatchObject({
      calculatedRequirement: null,
      shoppingAmount: null,
    })
  })

  it('includes manual contributions and applies a stable shopping override without changing recipe math', () => {
    const manual = {
      id: 'manual-1',
      ingredient: ingredient({
        originalText: '1 cup onions',
        quantity: '1',
      }),
    }
    const input = {
      selections: [selection('recipe', 'Tacos', '1', [ingredient()])],
      manualAdditions: [manual],
    }
    const generated = generateGroceryItems(input)

    expect(generated[0]?.id).toBe('grocery:merged:onions:volume:cup')
    expect(
      generateGroceryItems({
        ...input,
        overrides: [
          {
            itemId: generated[0]!.id,
            quantity: { min: '5' },
          },
        ],
      }),
    ).toMatchObject([
      {
        calculatedRequirement: { min: '3' },
        shoppingAmount: { min: '5' },
        override: { min: '5' },
        contributions: [
          { source: { kind: 'manual', additionId: 'manual-1' } },
          { source: { kind: 'recipe', recipeTitle: 'Tacos' } },
        ],
      },
    ])
  })
})
