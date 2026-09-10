import { describe, expect, it } from 'vitest'
import {
  createDraftDocument,
  createDraftSchema,
  draftOwnerFilter,
  isUsableRecipe,
  privateDraftFilter,
  recipeIngredientSchema,
  recipeInstructionSchema,
  recipeImageProvenanceSchema,
  recipeMetadataSchema,
  recipeNutritionSchema,
  typicalPeopleFedSchema,
  toRecipeDraft,
  updateDraftSchema,
} from '@/lib/recipes/drafts'

describe('recipe drafts', () => {
  it('accepts a trimmed title and rejects blank or oversized titles', () => {
    expect(
      createDraftSchema.parse({ title: '  Tomato soup\u0000  ' }).title,
    ).toBe('Tomato soup')
    expect(createDraftSchema.safeParse({ title: ' ' }).success).toBe(false)
    expect(
      createDraftSchema.safeParse({ title: 'x'.repeat(201) }).success,
    ).toBe(false)
  })

  it('creates private drafts owned by the authenticated user', () => {
    const draft = createDraftDocument('user-1', 'Tomato soup')

    expect(draft).toMatchObject({
      ownerId: 'user-1',
      title: 'Tomato soup',
      status: 'draft',
      visibility: 'private',
      ingredients: [],
    })
    expect(toRecipeDraft(draft).id).toBe(draft._id)
    expect(draft.createdAt).toBe(draft.updatedAt)
  })

  it('scopes every lookup to both the draft id and owner', () => {
    expect(draftOwnerFilter('user-1', 'draft-1')).toEqual({
      _id: 'draft-1',
      ownerId: 'user-1',
    })
    expect(draftOwnerFilter('user-1')).toEqual({ ownerId: 'user-1' })
    expect(privateDraftFilter('user-1', 'draft-1')).toEqual({
      _id: 'draft-1',
      ownerId: 'user-1',
      status: { $in: ['draft', 'usable'] },
      visibility: 'private',
    })
  })

  it('keeps a recipe in draft state until yield and a structured ingredient exist', () => {
    const ingredient = recipeIngredientSchema.parse({
      originalText: '  2 yellow onions, diced\u0000 ',
      quantity: '2',
      unit: 'each',
      ingredientName: '  Yellow onions ',
      preparationNote: 'diced',
      optional: false,
    })

    expect(isUsableRecipe(undefined, [ingredient])).toBe(false)
    expect(isUsableRecipe(0, [ingredient])).toBe(false)
    expect(isUsableRecipe(4, [])).toBe(false)
    expect(isUsableRecipe(4, [ingredient])).toBe(true)
    expect(
      createDraftDocument('user-1', 'Soup', {
        typicalPeopleFed: 4,
        ingredients: [ingredient],
      }).status,
    ).toBe('usable')
    expect(ingredient.originalText).toBe('2 yellow onions, diced')
    expect(typicalPeopleFedSchema.safeParse(2.5).success).toBe(false)
  })

  it('sanitizes and bounds an optional description', () => {
    expect(
      updateDraftSchema.parse({ description: '  A cozy soup.\u0000  ' })
        .description,
    ).toBe('A cozy soup.')
    expect(
      updateDraftSchema.safeParse({ description: 'x'.repeat(2001) }).success,
    ).toBe(false)
    expect(
      updateDraftSchema.parse({ description: null }).description,
    ).toBeNull()
  })

  it('sanitizes ordered instructions and rejects blank or oversized steps', () => {
    expect(recipeInstructionSchema.parse('  Stir until smooth.\u0000  ')).toBe(
      'Stir until smooth.',
    )
    expect(recipeInstructionSchema.safeParse('  ').success).toBe(false)
    expect(recipeInstructionSchema.safeParse('x'.repeat(2001)).success).toBe(
      false,
    )
    expect(
      updateDraftSchema.safeParse({
        instructions: Array.from({ length: 101 }, () => 'Do a thing.'),
      }).success,
    ).toBe(false)
  })

  it('validates bounded timing and normalized recipe labels', () => {
    expect(
      recipeMetadataSchema.parse({
        prepTimeMinutes: 15,
        cookingTimeMinutes: 30,
        totalTimeMinutes: 45,
        cuisine: '  Mediterranean\u0000 ',
        mealType: ' Dinner ',
        householdNotes: '  Use less salt for the kids.\u0000 ',
        sourceName: '  Neighborhood cookbook\u0000 ',
        sourceUrl: ' https://example.com/recipe ',
        sourceAuthor: ' Alex Rivera ',
        attribution: '  Adapted with permission.\u0000 ',
        tags: ['weeknight', 'make ahead'],
        dietaryLabels: ['vegetarian'],
      }),
    ).toEqual({
      prepTimeMinutes: 15,
      cookingTimeMinutes: 30,
      totalTimeMinutes: 45,
      cuisine: 'Mediterranean',
      mealType: 'Dinner',
      householdNotes: 'Use less salt for the kids.',
      sourceName: 'Neighborhood cookbook',
      sourceUrl: 'https://example.com/recipe',
      sourceAuthor: 'Alex Rivera',
      attribution: 'Adapted with permission.',
      tags: ['weeknight', 'make ahead'],
      dietaryLabels: ['vegetarian'],
    })
    expect(
      recipeMetadataSchema.safeParse({ prepTimeMinutes: -1 }).success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({ tags: ['Weeknight', 'weeknight'] })
        .success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({ tags: ['x'.repeat(51)] }).success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({
        householdNotes: 'x'.repeat(2001),
      }).success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({ sourceUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({ sourceUrl: 'ftp://example.com/recipe' })
        .success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({ attribution: 'x'.repeat(1001) }).success,
    ).toBe(false)
  })

  it('records image provenance and keeps reuse rights explicit', () => {
    expect(
      recipeImageProvenanceSchema.parse({
        url: ' https://images.example.com/soup.jpg ',
        altText: '  Tomato soup with herbs\u0000 ',
        sourceName: '  My kitchen ',
        sourceUrl: ' https://example.com/image ',
        creator: '  Alex Rivera ',
        license: '  Personal permission ',
        rightsStatus: 'permission-granted',
      }),
    ).toEqual({
      url: 'https://images.example.com/soup.jpg',
      altText: 'Tomato soup with herbs',
      sourceName: 'My kitchen',
      sourceUrl: 'https://example.com/image',
      creator: 'Alex Rivera',
      license: 'Personal permission',
      rightsStatus: 'permission-granted',
    })
    expect(
      recipeImageProvenanceSchema.parse({
        url: 'https://images.example.com/soup.jpg',
      }).rightsStatus,
    ).toBe('unknown')
    expect(
      recipeImageProvenanceSchema.safeParse({
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false)
    expect(
      recipeImageProvenanceSchema.safeParse({
        url: 'https://images.example.com/soup.jpg',
        altText: 'x'.repeat(301),
      }).success,
    ).toBe(false)
  })

  it('accepts bounded optional nutrition values per person', () => {
    expect(
      recipeNutritionSchema.parse({
        calories: 420,
        proteinGrams: 18.5,
        carbohydratesGrams: 52,
        fatGrams: 12,
        fiberGrams: 7,
        sodiumMilligrams: 640,
      }),
    ).toEqual({
      calories: 420,
      proteinGrams: 18.5,
      carbohydratesGrams: 52,
      fatGrams: 12,
      fiberGrams: 7,
      sodiumMilligrams: 640,
    })
    expect(recipeNutritionSchema.safeParse({}).success).toBe(false)
    expect(recipeNutritionSchema.safeParse({ proteinGrams: -1 }).success).toBe(
      false,
    )
    expect(
      recipeNutritionSchema.safeParse({ sodiumMilligrams: 100001 }).success,
    ).toBe(false)
  })
})
