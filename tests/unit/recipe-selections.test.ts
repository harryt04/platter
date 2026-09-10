import { describe, expect, it } from 'vitest'
import {
  calculateRecipeScaleFactor,
  createRecipeSelectionDocument,
  createRecipeSelectionSchema,
} from '@/lib/recipes/selections'

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
})
