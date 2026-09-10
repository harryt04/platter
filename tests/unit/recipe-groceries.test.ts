import fc from 'fast-check'
import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { decimalString } from '@/lib/contracts/ids'
import {
  findGroceryMergeSuggestions,
  generateGroceryItems,
  type GroceryRecipeSelection,
} from '@/lib/recipes/groceries'
import { convertIngredientQuantity } from '@/lib/recipes/ingredient-parser'

const CalculationDecimal = Decimal.clone({ precision: 40 })

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

  it('keeps a corrected contribution separate through deterministic regeneration', () => {
    const input = {
      selections: [
        selection('first', 'Tacos', '1', [ingredient()]),
        selection('second', 'Curry', '1', [ingredient({ quantity: '3' })]),
      ],
      splitContributionIds: ['recipe:first:0'],
    }

    const first = generateGroceryItems(input)
    const second = generateGroceryItems(input)

    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first).toMatchObject([
      {
        id: 'grocery:merged:onions:volume:cup',
        calculatedRequirement: { min: '3' },
        contributions: [{ id: 'recipe:second:0' }],
      },
      {
        id: 'grocery:split:recipe:first:0',
        calculatedRequirement: { min: '2' },
        contributions: [{ id: 'recipe:first:0' }],
      },
    ])
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

  it('keeps low-confidence identities separate for every generated quantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (firstAmount, secondAmount) => {
          const items = generateGroceryItems({
            selections: [
              selection('first', 'First recipe', '1', [
                ingredient({
                  originalText: `${firstAmount} onions`,
                  quantity: String(firstAmount),
                  unit: 'each',
                  normalizedIdentity: 'onions',
                  parserConfidence: 'low',
                }),
              ]),
              selection('second', 'Second recipe', '1', [
                ingredient({
                  originalText: `${secondAmount} onions`,
                  quantity: String(secondAmount),
                  unit: 'each',
                  normalizedIdentity: 'onions',
                  parserConfidence: 'low',
                }),
              ]),
            ],
          })

          expect(items).toHaveLength(2)
          expect(items.every((item) => item.contributions)).toBe(true)
          expect(items.map((item) => item.contributions)).toEqual(
            expect.arrayContaining([
              [expect.objectContaining({ id: 'recipe:first:0' })],
              [expect.objectContaining({ id: 'recipe:second:0' })],
            ]),
          )
        },
      ),
    )
  })

  it('merges generated mass and volume contributions with exact conversion', () => {
    const compatibleUnits = [
      { name: 'g', dimension: 'mass' },
      { name: 'kg', dimension: 'mass' },
      { name: 'oz', dimension: 'mass' },
      { name: 'lb', dimension: 'mass' },
      { name: 'ml', dimension: 'volume' },
      { name: 'l', dimension: 'volume' },
      { name: 'tsp', dimension: 'volume' },
      { name: 'tbsp', dimension: 'volume' },
      { name: 'cup', dimension: 'volume' },
      { name: 'pint', dimension: 'volume' },
      { name: 'quart', dimension: 'volume' },
      { name: 'gallon', dimension: 'volume' },
      { name: 'fl oz', dimension: 'volume' },
    ] as const

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom(...compatibleUnits),
        fc.constantFrom(...compatibleUnits),
        (firstAmount, secondAmount, firstUnit, secondUnit) => {
          fc.pre(firstUnit.dimension === secondUnit.dimension)
          const items = generateGroceryItems({
            selections: [
              selection('first', 'First recipe', '1', [
                ingredient({
                  originalText: `${firstAmount} ${firstUnit.name} onions`,
                  quantity: String(firstAmount),
                  unit: firstUnit.name,
                }),
              ]),
              selection('second', 'Second recipe', '1', [
                ingredient({
                  originalText: `${secondAmount} ${secondUnit.name} onions`,
                  quantity: String(secondAmount),
                  unit: secondUnit.name,
                }),
              ]),
            ],
          })
          const convertedSecond = convertIngredientQuantity(
            { min: String(secondAmount) },
            secondUnit,
            firstUnit,
          )

          expect(convertedSecond).not.toBeNull()
          expect(items).toHaveLength(1)
          expect(items[0]).toMatchObject({
            unit: firstUnit,
            calculatedRequirement: {
              min: new CalculationDecimal(String(firstAmount))
                .plus(convertedSecond!.min)
                .toString(),
            },
          })
        },
      ),
    )
  })

  it('preserves every generated contribution and its recipe provenance', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), {
          minLength: 1,
          maxLength: 8,
        }),
        (amounts) => {
          const selections = amounts.map((amount, index) =>
            selection(String(index), `Recipe ${index}`, '1', [
              ingredient({
                originalText: `${amount} cups onions`,
                quantity: String(amount),
                unit: 'cup',
              }),
            ]),
          )
          const generated = generateGroceryItems({ selections })
          const contributions = generated.flatMap((item) => item.contributions)

          expect(generated).toHaveLength(1)
          expect(contributions).toHaveLength(amounts.length)
          expect(contributions.map((contribution) => contribution.id)).toEqual(
            amounts.map((_, index) => `recipe:${index}:0`),
          )
          expect(
            contributions.map((contribution) => contribution.source),
          ).toEqual(
            amounts.map((_, index) => ({
              kind: 'recipe',
              selectionId: String(index),
              recipeId: `recipe-${index}`,
              versionId: `version-${index}`,
              recipeTitle: `Recipe ${index}`,
            })),
          )
          expect(
            contributions.map((contribution) => contribution.originalText),
          ).toEqual(amounts.map((amount) => `${amount} cups onions`))
        },
      ),
    )
  })

  it('removes one recipe contribution without changing the remaining aggregate', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), {
          minLength: 2,
          maxLength: 8,
        }),
        fc.nat(),
        (amounts, removalSeed) => {
          const selections = amounts.map((amount, index) =>
            selection(String(index), `Recipe ${index}`, '1', [
              ingredient({
                originalText: `${amount} cups onions`,
                quantity: String(amount),
                unit: 'cup',
              }),
            ]),
          )
          const removedIndex = removalSeed % amounts.length
          const before = generateGroceryItems({ selections })[0]!
          const after = generateGroceryItems({
            selections: selections.filter((_, index) => index !== removedIndex),
          })[0]!
          const remainingTotal = amounts.reduce(
            (total, amount, index) =>
              index === removedIndex ? total : total.plus(String(amount)),
            new CalculationDecimal(0),
          )

          expect(after.contributions).toHaveLength(amounts.length - 1)
          expect(after.contributions).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: `recipe:${removedIndex}:0`,
              }),
            ]),
          )
          expect(after.calculatedRequirement).toEqual({
            min: remainingTotal.toString(),
          })
          expect(before.contributions).toHaveLength(amounts.length)
        },
      ),
    )
  })
})

it('offers deterministic optional suggestions without merging low-confidence items', () => {
  const items = generateGroceryItems({
    selections: [
      selection('first', 'First recipe', '1', [
        ingredient({
          originalText: 'some onions',
          quantity: '1',
          unit: 'each',
          ingredientName: 'onions',
          normalizedIdentity: 'onions',
          parserConfidence: 'low',
        }),
      ]),
      selection('second', 'Second recipe', '1', [
        ingredient({
          originalText: '1 onion, sliced',
          quantity: '1',
          unit: 'each',
          ingredientName: 'onion',
          normalizedIdentity: 'onions',
          parserConfidence: 'low',
        }),
      ]),
      selection('red', 'Red onion recipe', '1', [
        ingredient({
          originalText: '1 red onion',
          quantity: '1',
          unit: 'each',
          ingredientName: 'red onion',
          normalizedIdentity: 'red onion',
          parserConfidence: 'low',
        }),
      ]),
    ],
  })

  expect(items).toHaveLength(3)
  expect(items.map((item) => item.id)).toEqual([
    'grocery:recipe:first:0',
    'grocery:recipe:red:0',
    'grocery:recipe:second:0',
  ])
  expect(findGroceryMergeSuggestions(items)).toMatchObject([
    {
      id: 'grocery-merge-suggestion:grocery:recipe:first:0:grocery:recipe:second:0',
      left: { id: 'grocery:recipe:first:0' },
      right: { id: 'grocery:recipe:second:0' },
    },
  ])
  expect(items[0]?.contributions).toHaveLength(1)
  expect(items[2]?.contributions).toHaveLength(1)
  expect(items[0]?.calculatedRequirement).toEqual({ min: '1' })
  expect(items[2]?.calculatedRequirement).toEqual({ min: '1' })
})
