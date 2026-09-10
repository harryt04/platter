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
  status: 'draft' as const,
  visibility: 'private' as const,
  ingredients: [],
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
        }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).recipe).toMatchObject({
      title: 'Tomato soup',
      status: 'usable',
      typicalPeopleFed: 4,
      ingredients: [{ ingredientName: 'onions' }],
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
})
