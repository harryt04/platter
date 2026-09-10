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

  it('keeps uncertain identities, incompatible dimensions, and missing amounts separate', () => {
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
        selection('mass', 'Mass', '1', [
          ingredient({
            originalText: '2 kg onions',
            quantity: '2',
            unit: 'kg',
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

  it('converts compatible high-confidence volume contributions to the first unit', () => {
    const items = generateGroceryItems({
      selections: [
        selection('cups', 'Soup', '1', [
          ingredient({
            originalText: '2 cups onions',
            quantity: '2',
            unit: 'cup',
          }),
        ]),
        selection('tablespoons', 'Sauce', '1', [
          ingredient({
            originalText: '2 tbsp onions',
            quantity: '2',
            unit: 'tbsp',
          }),
        ]),
      ],
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'grocery:merged:onions:volume:cup',
      unit: { name: 'cup', dimension: 'volume' },
      calculatedRequirement: { min: '2.125' },
      contributions: [
        {
          unit: { name: 'cup', dimension: 'volume' },
          calculatedQuantity: { min: '2' },
        },
        {
          unit: { name: 'tbsp', dimension: 'volume' },
          calculatedQuantity: { min: '2' },
        },
      ],
    })
  })

  it('keeps cross-dimension and uncertain contributions separate', () => {
    const items = generateGroceryItems({
      selections: [
        selection('volume', 'Chopped onions', '1', [
          ingredient({
            originalText: '1 cup onions',
            quantity: '1',
            unit: 'cup',
          }),
        ]),
        selection('mass', 'Roasted onions', '1', [
          ingredient({
            originalText: '100 g onions',
            quantity: '100',
            unit: 'g',
          }),
        ]),
        selection('uncertain', 'Unknown onions', '1', [
          ingredient({
            originalText: 'some onions',
            quantity: '',
            unit: '',
            parserConfidence: 'low',
          }),
        ]),
        selection('count', 'Onion bundles', '1', [
          ingredient({
            originalText: '1 bunch onions',
            quantity: '1',
            unit: 'bunch',
          }),
        ]),
      ],
    })

    expect(items).toHaveLength(4)
    expect(items.map((item) => item.dimension).sort()).toEqual([
      'count',
      'mass',
      'unknown',
      'volume',
    ])
    expect(
      Object.fromEntries(
        items.map((item) => [item.dimension, item.calculatedRequirement]),
      ),
    ).toEqual({
      count: { min: '1' },
      mass: { min: '100' },
      unknown: null,
      volume: { min: '1' },
    })
    expect(new Set(items.map((item) => item.id)).size).toBe(4)
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

  it('removes an item when its last recipe contribution is removed', () => {
    const input = {
      selections: [selection('recipe', 'Tacos', '1', [ingredient()])],
    }
    const generated = generateGroceryItems(input)

    expect(generated).toHaveLength(1)
    expect(generateGroceryItems({ selections: [] })).toEqual([])
  })

  it('retains a manual contribution when the last recipe contribution is removed', () => {
    const manual = {
      id: 'manual-1',
      ingredient: ingredient({
        originalText: '1 cup onions',
        quantity: '1',
      }),
    }
    const generated = generateGroceryItems({
      selections: [selection('recipe', 'Tacos', '1', [ingredient()])],
      manualAdditions: [manual],
    })

    const afterRecipeRemoval = generateGroceryItems({
      selections: [],
      manualAdditions: [manual],
    })

    expect(afterRecipeRemoval).toMatchObject([
      {
        id: generated[0]?.id,
        calculatedRequirement: { min: '1' },
        contributions: [{ source: { kind: 'manual', additionId: 'manual-1' } }],
      },
    ])
  })

  it('retains an intentional override without inventing a current requirement', () => {
    const generated = generateGroceryItems({
      selections: [selection('recipe', 'Tacos', '1', [ingredient()])],
    })
    const item = generated[0]!

    expect(
      generateGroceryItems({
        selections: [],
        overrides: [
          {
            itemId: item.id,
            quantity: { min: '1' },
            preservedItem: {
              ingredientName: item.ingredientName,
              normalizedIdentity: item.normalizedIdentity,
              dimension: item.dimension,
              unit: item.unit,
            },
          },
        ],
      }),
    ).toEqual([
      {
        id: item.id,
        ingredientName: item.ingredientName,
        normalizedIdentity: item.normalizedIdentity,
        dimension: item.dimension,
        unit: item.unit,
        calculatedRequirement: null,
        shoppingAmount: { min: '1' },
        override: { min: '1' },
        contributions: [],
      },
    ])
  })
})
