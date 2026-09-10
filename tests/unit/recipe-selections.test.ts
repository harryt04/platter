import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { decimalString } from '@/lib/contracts/ids'
import {
  acceptNewerRecipeVersion,
  calculateRecipeScaleFactor,
  createRecipeSelectionDocument,
  createRecipeSelectionSchema,
  duplicateRecipeSelectionDocument,
  removeRecipeSelectionDocument,
  updateRecipeSelectionDocument,
} from '@/lib/recipes/selections'
import {
  calculateScaledIngredients,
  scaleIngredientQuantity,
} from '@/lib/recipes/scaling'

describe('recipe selections', () => {
  it('calculates exact four-to-two and four-to-six scale factors', () => {
    expect(calculateRecipeScaleFactor(2, 4)).toBe('0.5')
    expect(calculateRecipeScaleFactor(6, 4)).toBe('1.5')
  })

  it('rejects zero, fractional, and oversized serving counts', () => {
    expect(
      createRecipeSelectionSchema.safeParse({
        recipeId: 'recipe-1',
        desiredPeople: 0,
      }).success,
    ).toBe(false)
    expect(
      createRecipeSelectionSchema.safeParse({
        recipeId: 'recipe-1',
        desiredPeople: 2.5,
      }).success,
    ).toBe(false)
    expect(
      createRecipeSelectionSchema.safeParse({
        recipeId: 'recipe-1',
        desiredPeople: 1001,
      }).success,
    ).toBe(false)
  })

  it('pins the recipe version and stores the precise scale factor', () => {
    const selection = createRecipeSelectionDocument(
      {
        _id: 'recipe-1',
        recipeId: 'recipe-1',
        versionId: 'version-4',
        versionNumber: 4,
        typicalPeopleFed: 4,
      },
      6,
      new Date('2026-09-10T12:00:00.000Z'),
    )

    expect(selection).toMatchObject({
      recipeId: 'recipe-1',
      versionId: 'version-4',
      versionNumber: 4,
      desiredPeople: 6,
      scaleFactor: '1.5',
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:00:00.000Z',
    })
  })

  it('updates only the selected version reference while preserving its identity', () => {
    const selection = createRecipeSelectionDocument(
      {
        _id: 'recipe-1',
        recipeId: 'recipe-1',
        versionId: 'version-4',
        versionNumber: 4,
        typicalPeopleFed: 4,
      },
      2,
      new Date('2026-09-10T12:00:00.000Z'),
    )

    expect(
      updateRecipeSelectionDocument(
        selection,
        6,
        4,
        new Date('2026-09-10T12:05:00.000Z'),
      ),
    ).toMatchObject({
      _id: selection._id,
      recipeId: 'recipe-1',
      versionId: 'version-4',
      versionNumber: 4,
      desiredPeople: 6,
      scaleFactor: '1.5',
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:05:00.000Z',
    })
  })

  it('accepts a newer version without changing the selection identity or people', () => {
    const selection = createRecipeSelectionDocument(
      {
        _id: 'recipe-1',
        recipeId: 'recipe-1',
        versionId: 'version-4',
        versionNumber: 4,
        typicalPeopleFed: 4,
      },
      6,
      new Date('2026-09-10T12:00:00.000Z'),
    )

    expect(
      acceptNewerRecipeVersion(
        selection,
        {
          _id: 'version-5',
          recipeId: 'recipe-1',
          versionNumber: 5,
          typicalPeopleFed: 3,
        },
        new Date('2026-09-10T12:05:00.000Z'),
      ),
    ).toMatchObject({
      _id: selection._id,
      recipeId: 'recipe-1',
      versionId: 'version-5',
      versionNumber: 5,
      desiredPeople: 6,
      scaleFactor: '2',
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:05:00.000Z',
    })
  })

  it('duplicates a selection with a new identity while preserving its pinned version and scale', () => {
    const selection = createRecipeSelectionDocument(
      {
        _id: 'recipe-1',
        recipeId: 'recipe-1',
        versionId: 'version-4',
        versionNumber: 4,
        typicalPeopleFed: 4,
      },
      6,
      new Date('2026-09-10T12:00:00.000Z'),
    )

    const duplicate = duplicateRecipeSelectionDocument(
      selection,
      new Date('2026-09-10T12:05:00.000Z'),
    )

    expect(duplicate).toMatchObject({
      recipeId: 'recipe-1',
      versionId: 'version-4',
      versionNumber: 4,
      desiredPeople: 6,
      scaleFactor: '1.5',
      createdAt: '2026-09-10T12:05:00.000Z',
      updatedAt: '2026-09-10T12:05:00.000Z',
    })
    expect(duplicate._id).not.toBe(selection._id)
  })

  it('proves changing one selection cannot change another selection contribution', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (otherPeople, targetPeople, nextTargetPeople) => {
          const otherSelection = createRecipeSelectionDocument(
            {
              _id: 'recipe-other',
              recipeId: 'recipe-other',
              versionId: 'version-other',
              versionNumber: 1,
              typicalPeopleFed: 4,
            },
            otherPeople,
            new Date('2026-09-10T12:00:00.000Z'),
          )
          const targetSelection = createRecipeSelectionDocument(
            {
              _id: 'recipe-target',
              recipeId: 'recipe-target',
              versionId: 'version-target',
              versionNumber: 1,
              typicalPeopleFed: 4,
            },
            targetPeople,
            new Date('2026-09-10T12:00:00.000Z'),
          )

          const updatedTarget = updateRecipeSelectionDocument(
            targetSelection,
            nextTargetPeople,
            4,
            new Date('2026-09-10T12:05:00.000Z'),
          )
          const updatedSelections = [otherSelection, targetSelection].map(
            (selection) =>
              selection._id === targetSelection._id ? updatedTarget : selection,
          )
          const updatedOtherSelection = updatedSelections.find(
            (selection) => selection._id === otherSelection._id,
          )
          const otherContributionBefore = calculateScaledIngredients(
            [
              {
                originalText: '2 onions',
                quantity: '2',
                unit: 'each',
                ingredientName: 'onions',
                optional: false,
              },
            ],
            otherSelection.scaleFactor,
          )
          const otherContributionAfter = calculateScaledIngredients(
            [
              {
                originalText: '2 onions',
                quantity: '2',
                unit: 'each',
                ingredientName: 'onions',
                optional: false,
              },
            ],
            updatedOtherSelection!.scaleFactor,
          )

          expect(updatedTarget._id).toBe(targetSelection._id)
          expect(updatedTarget.desiredPeople).toBe(nextTargetPeople)
          expect(updatedOtherSelection).toEqual(otherSelection)
          expect(otherContributionAfter).toEqual(otherContributionBefore)
        },
      ),
    )
  })

  it('proves removing one selection preserves every other selection and contribution', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (otherPeople, targetPeople) => {
          const otherSelection = createRecipeSelectionDocument(
            {
              _id: 'recipe-other',
              recipeId: 'recipe-other',
              versionId: 'version-other',
              versionNumber: 1,
              typicalPeopleFed: 4,
            },
            otherPeople,
          )
          const targetSelection = createRecipeSelectionDocument(
            {
              _id: 'recipe-target',
              recipeId: 'recipe-target',
              versionId: 'version-target',
              versionNumber: 1,
              typicalPeopleFed: 4,
            },
            targetPeople,
          )

          const remainingSelections = removeRecipeSelectionDocument(
            [otherSelection, targetSelection],
            targetSelection._id,
          )
          const otherContributionBefore = calculateScaledIngredients(
            [
              {
                originalText: '2 onions',
                quantity: '2',
                unit: 'each',
                ingredientName: 'onions',
                optional: false,
              },
            ],
            otherSelection.scaleFactor,
          )
          const otherContributionAfter = calculateScaledIngredients(
            [
              {
                originalText: '2 onions',
                quantity: '2',
                unit: 'each',
                ingredientName: 'onions',
                optional: false,
              },
            ],
            remainingSelections[0]!.scaleFactor,
          )

          expect(remainingSelections).toEqual([otherSelection])
          expect(otherContributionAfter).toEqual(otherContributionBefore)
        },
      ),
    )
  })

  it('scales decimal quantities without applying display rounding', () => {
    expect(
      scaleIngredientQuantity(
        { min: '0.3333333333333333333333333333333333333333' },
        decimalString('1.5'),
      ),
    ).toEqual({ min: '0.5' })
  })

  it('keeps source quantities and count suggestions separate', () => {
    const ingredients = calculateScaledIngredients(
      [
        {
          originalText: '2 onions',
          quantity: '2',
          unit: 'each',
          ingredientName: 'onions',
          optional: false,
        },
        {
          originalText: 'salt, to taste',
          quantity: undefined,
          unit: undefined,
          ingredientName: 'salt',
          optional: true,
        },
      ],
      decimalString('1.5'),
    )

    expect(ingredients).toEqual([
      expect.objectContaining({
        sourceQuantity: '2',
        calculatedQuantity: { min: '3' },
        suggestedShoppingQuantity: { min: '3' },
      }),
      expect.objectContaining({
        sourceQuantity: null,
        calculatedQuantity: null,
        suggestedShoppingQuantity: null,
        optional: true,
      }),
    ])
  })
})
