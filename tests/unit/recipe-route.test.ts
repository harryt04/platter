import { describe, expect, it, vi } from 'vitest'
import { GET, PATCH } from '@/app/api/v1/recipes/[recipeId]/route'

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
      versionNumber: 2,
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
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: 'recipe-1' },
      {
        $setOnInsert: expect.objectContaining({
          recipeId: 'recipe-1',
          versionNumber: 1,
          title: 'Tomato soup',
        }),
      },
      { upsert: true },
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

  it('creates a private variant instead of mutating a published recipe', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const publicDraft = {
      ...draft,
      status: 'usable' as const,
      visibility: 'public' as const,
      versionId: 'public-version-3',
      versionNumber: 3,
      typicalPeopleFed: 4,
      ingredients: [
        {
          originalText: '2 onions',
          quantity: '2',
          unit: 'each',
          ingredientName: 'onions',
          optional: false,
        },
      ],
    }
    const collection = {
      findOne: vi.fn().mockResolvedValue(publicDraft),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'My modified soup' }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    const result = (await response.json()).recipe
    expect(result).toMatchObject({
      title: 'My modified soup',
      visibility: 'private',
      versionNumber: 1,
      derivedFrom: {
        recipeId: 'recipe-1',
        versionId: 'public-version-3',
        versionNumber: 3,
      },
    })
    expect(result.id).not.toBe('recipe-1')
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My modified soup',
        visibility: 'private',
        derivedFrom: {
          recipeId: 'recipe-1',
          versionId: 'public-version-3',
          versionNumber: 3,
        },
      }),
    )
    expect(collection.updateOne).not.toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'recipe-1', ownerId: 'user-1' }),
      expect.anything(),
    )
  })

  it('rejects a stale version instead of claiming an edit was saved', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue({
        ...draft,
        versionId: 'version-1',
        versionNumber: 1,
      }),
      updateOne: vi
        .fn()
        .mockResolvedValueOnce({ acknowledged: true, upsertedCount: 0 })
        .mockResolvedValueOnce({ acknowledged: true, matchedCount: 0 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title' }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('RECIPE_VERSION_CONFLICT')
  })

  it('preserves parser metadata when a user corrects ingredient facts', async () => {
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
          typicalPeopleFed: 4,
          ingredients: [
            {
              originalText: '1 cup onions',
              quantity: '2',
              unit: 'each',
              ingredientName: 'red onions',
              normalizedIdentity: 'onions',
              parserConfidence: 'high',
              optional: false,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).recipe.ingredients).toEqual([
      {
        originalText: '1 cup onions',
        quantity: '2',
        unit: 'each',
        ingredientName: 'red onions',
        normalizedIdentity: 'onions',
        parserConfidence: 'high',
        optional: false,
      },
    ])
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          ingredients: [
            expect.objectContaining({
              originalText: '1 cup onions',
              ingredientName: 'red onions',
              normalizedIdentity: 'onions',
              parserConfidence: 'high',
            }),
          ],
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
          image: {
            url: ' https://images.example.com/soup.jpg ',
            altText: ' Tomato soup with herbs\u0000 ',
            sourceName: ' My kitchen ',
            sourceUrl: ' https://example.com/image ',
            creator: ' Alex Rivera ',
            license: ' Personal permission ',
            rightsStatus: 'permission-granted',
          },
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
      image: {
        url: 'https://images.example.com/soup.jpg',
        altText: 'Tomato soup with herbs',
        sourceName: 'My kitchen',
        sourceUrl: 'https://example.com/image',
        creator: 'Alex Rivera',
        license: 'Personal permission',
        rightsStatus: 'permission-granted',
      },
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
          image: expect.objectContaining({
            url: 'https://images.example.com/soup.jpg',
            rightsStatus: 'permission-granted',
          }),
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
          image: null,
          nutrition: null,
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    const result = (await response.json()).recipe
    expect(response.status).toBe(200)
    expect(result).not.toHaveProperty('cuisine')
    expect(result).not.toHaveProperty('householdNotes')
    expect(result).not.toHaveProperty('prepTimeMinutes')
    expect(result).not.toHaveProperty('image')
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
          image: '',
          nutrition: '',
        },
      }),
    )
  })

  it('persists and clears optional nutrition values', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(draft),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const saved = await PATCH(
      new Request('http://localhost/api/v1/recipes/recipe-1', {
        method: 'PATCH',
        body: JSON.stringify({
          nutrition: {
            calories: 420,
            proteinGrams: 18.5,
            sodiumMilligrams: 640,
          },
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(saved.status).toBe(200)
    expect((await saved.json()).recipe.nutrition).toEqual({
      calories: 420,
      proteinGrams: 18.5,
      sodiumMilligrams: 640,
    })
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          nutrition: {
            calories: 420,
            proteinGrams: 18.5,
            sodiumMilligrams: 640,
          },
        }),
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

describe('GET /api/v1/recipes/[recipeId]', () => {
  it('allows anonymous readers to view a public recipe', async () => {
    getSession.mockResolvedValue(null)
    const collection = {
      findOne: vi.fn().mockResolvedValue({
        ...draft,
        status: 'usable' as const,
        visibility: 'public' as const,
        householdNotes: 'Keep this private.',
        typicalPeopleFed: 4,
        ingredients: [
          {
            originalText: '2 onions',
            quantity: '2',
            unit: 'each',
            ingredientName: 'onions',
            optional: false,
          },
        ],
        instructions: ['Slice the onions.'],
        versionId: 'version-2',
        versionNumber: 2,
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await GET(
      new Request('http://localhost/api/v1/recipes/recipe-1'),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.recipe).toMatchObject({
      id: 'recipe-1',
      visibility: 'public',
      title: 'Tomato soup',
      versionNumber: 2,
    })
    expect(result.recipe).not.toHaveProperty('householdNotes')
    expect(collection.findOne).toHaveBeenCalledWith({
      _id: 'recipe-1',
      status: 'usable',
      visibility: 'public',
      $or: [
        { origin: { $exists: false } },
        { origin: 'authored' },
        { origin: 'imported', importReviewStatus: 'approved' },
      ],
    })
  })

  it('allows a current member of a selected list to read a shared recipe', async () => {
    getSession.mockResolvedValue({ user: { id: 'member-1' } })
    const collection = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ recipeId: 'recipe-1', listId: 'list-1' })
        .mockResolvedValueOnce({
          ...draft,
          status: 'usable' as const,
          visibility: 'list-shared' as const,
          householdNotes: 'Owner-only note.',
        }),
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{ _id: 'list-1' }]),
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await GET(
      new Request('http://localhost/api/v1/recipes/recipe-1'),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.recipe).toMatchObject({
      id: 'recipe-1',
      visibility: 'list-shared',
    })
    expect(result.recipe).not.toHaveProperty('householdNotes')
  })
})
