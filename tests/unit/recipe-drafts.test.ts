import { describe, expect, it } from 'vitest'
import {
  createDraftDocument,
  createDraftSchema,
  draftOwnerFilter,
  isUsableRecipe,
  privateDraftFilter,
  recipeIngredientSchema,
  typicalPeopleFedSchema,
  toRecipeDraft,
} from '@/lib/recipes/drafts'

describe('recipe drafts', () => {
  it('accepts a trimmed title and rejects blank or oversized titles', () => {
    expect(createDraftSchema.parse({ title: '  Tomato soup  ' }).title).toBe(
      'Tomato soup',
    )
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
})
