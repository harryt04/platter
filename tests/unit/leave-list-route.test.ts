import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/[listId]/leave/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const list = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['owner-1'],
  status: 'active' as const,
  activeRunId: 'run-1',
  members: [
    {
      userId: 'owner-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
    {
      userId: 'editor-1',
      role: 'editor' as const,
      invitationState: 'active' as const,
    },
  ],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

describe('POST /api/v1/lists/[listId]/leave', () => {
  it('rejects malformed list ids before touching list storage', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = { findOneAndUpdate: vi.fn() }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/leave', {
        method: 'POST',
      }),
      { params: Promise.resolve({ listId: 'list-\u0000-1' }) },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('removes an active editor with a list-scoped atomic update', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...list,
        members: [list.members[0]],
        updatedAt: '2026-09-10T12:01:00.000Z',
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/leave', {
        method: 'POST',
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.members).toHaveLength(1)
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'list-1',
        status: { $ne: 'deleted' },
        $or: [
          {
            members: {
              $elemMatch: {
                userId: 'editor-1',
                role: 'editor',
                invitationState: 'active',
              },
            },
          },
        ],
      },
      expect.objectContaining({
        $pull: {
          members: { userId: 'editor-1' },
          ownerIds: 'editor-1',
        },
      }),
      { returnDocument: 'after' },
    )
  })

  it('returns a clear conflict when the last owner tries to leave', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      findOneAndUpdate: vi.fn(),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/leave', {
        method: 'POST',
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('LAST_OWNER_REQUIRED')
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('allows an owner to leave after ownership has been shared', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const sharedList = { ...list, ownerIds: ['owner-1', 'owner-2'] }
    const collection = {
      findOne: vi.fn().mockResolvedValue(sharedList),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...sharedList,
        ownerIds: ['owner-2'],
        members: [list.members[1]],
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/leave', {
        method: 'POST',
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.ownerIds).toEqual(['owner-2'])
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'list-1',
        $or: [
          expect.objectContaining({
            'ownerIds.1': { $exists: true },
          }),
        ],
      }),
      expect.objectContaining({
        $pull: {
          members: { userId: 'owner-1' },
          ownerIds: 'owner-1',
        },
      }),
      { returnDocument: 'after' },
    )
  })

  it('does not reveal a list to a non-member', async () => {
    getSession.mockResolvedValue({ user: { id: 'stranger-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(null),
      findOneAndUpdate: vi.fn(),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/leave', {
        method: 'POST',
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
  })
})
