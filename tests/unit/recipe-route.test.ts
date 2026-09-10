import { describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/recipes/[recipeId]/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const draft = {
  _id: 'recipe-1',
  ownerId: 'user-1',
  title: 'Tomato soup',
  description: 'A comforting weeknight soup.',
  status: 'draft' as const,
  visibility: 'private' as const,
  ingredients: [],
  instructions: [],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

describe('PATCH /api/v1/recipes/[recipeId]', () => {
  it('transitions an owned draft to usable after valid structured details', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(draft),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: '  Tomato soup  ',
          description: '  A bright tomato soup.\u0000 ',
          typicalPeopleFed: 4,
          ingredients: [
            {
              originalText: '2 onions, diced',
              quantity: '2',
              unit: 'each',
              ingredientName: 'onions',
              preparationNote: 'diced',
              optional: false,
            },
          ],
          instructions: ['Stir the soup until smooth.\u0000'],
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).recipe).toMatchObject({
      title: 'Tomato soup',
      description: 'A bright tomato soup.',
      status: 'usable',
      typicalPeopleFed: 4,
      ingredients: [{ ingredientName: 'onions' }],
      instructions: ['Stir the soup until smooth.'],
    })
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'recipe-1',
        ownerId: 'user-1',
        status: { $in: ['draft', 'usable'] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'usable',
          typicalPeopleFed: 4,
          description: 'A bright tomato soup.',
          instructions: ['Stir the soup until smooth.'],
        }),
      }),
    )
  })

  it('preserves instruction order and sanitizes saved steps', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue({
        ...draft,
        instructions: ['First step', 'Second step'],
      }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({
          instructions: ['  Second step  ', 'First step\u0000'],
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).recipe.instructions).toEqual([
      'Second step',
      'First step',
    ])
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          instructions: ['Second step', 'First step'],
        }),
      }),
    )
  })

  it('keeps invalid yield or incomplete ingredients out of usable state', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(draft),
      updateOne: vi.fn(),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({ typicalPeopleFed: 0, ingredients: [] }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(collection.updateOne).not.toHaveBeenCalled()
  })

  it('can clear a saved description without leaving an empty field', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(draft),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({ description: null }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).recipe.description).toBeUndefined()
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $unset: { description: '' } }),
    )
  })

  it('persists sanitized timing and classification metadata', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(draft),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({
          prepTimeMinutes: 15,
          cookingTimeMinutes: 30,
          totalTimeMinutes: 45,
          cuisine: ' Mediterranean\u0000 ',
          mealType: ' Dinner ',
          householdNotes: ' Use less salt for the kids.\u0000 ',
          sourceName: ' Neighborhood cookbook\u0000 ',
          sourceUrl: ' https://example.com/recipe ',
          sourceAuthor: ' Alex Rivera ',
          attribution: ' Adapted with permission.\u0000 ',
          tags: ['weeknight', 'make ahead'],
          dietaryLabels: ['vegetarian'],
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).recipe).toMatchObject({
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
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          prepTimeMinutes: 15,
          cookingTimeMinutes: 30,
          totalTimeMinutes: 45,
          cuisine: 'Mediterranean',
          mealType: 'Dinner',
          householdNotes: 'Use less salt for the kids.',
          tags: ['weeknight', 'make ahead'],
          dietaryLabels: ['vegetarian'],
        }),
      }),
    )
  })

  it('clears optional metadata without storing empty values', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue({
        ...draft,
        cuisine: 'Mediterranean',
        householdNotes: 'Use less salt for the kids.',
        prepTimeMinutes: 15,
      }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({
          cuisine: '',
          householdNotes: '',
          prepTimeMinutes: null,
          sourceName: '',
          sourceUrl: null,
          sourceAuthor: '',
          attribution: '',
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    const result = (await response.json()).recipe
    expect(response.status).toBe(200)
    expect(result).not.toHaveProperty('cuisine')
    expect(result).not.toHaveProperty('householdNotes')
    expect(result).not.toHaveProperty('prepTimeMinutes')
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $unset: {
          cuisine: '',
          householdNotes: '',
          prepTimeMinutes: '',
          sourceName: '',
          sourceUrl: '',
          sourceAuthor: '',
          attribution: '',
        },
      }),
    )
  })

  it('rejects non-web source URLs without writing the draft', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(draft),
      updateOne: vi.fn(),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({ sourceUrl: 'javascript:alert(1)' }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(422)
    expect((await response.json()).fields.sourceUrl).toEqual([
      'Source URL must use HTTP or HTTPS.',
    ])
    expect(collection.updateOne).not.toHaveBeenCalled()
  })
})
