import { describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '@/app/api/v1/lists/[listId]/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const list = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['user-1'],
  status: 'active' as const,
  activeRunId: 'run-1',
  members: [
    {
      userId: 'user-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
  ],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

describe('PATCH /api/v1/lists/[listId]', () => {
  it('rejects malformed list ids without querying another list', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = { findOne: vi.fn() }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/%00', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Private rename' }),
      }),
      { params: Promise.resolve({ listId: 'list-\u0000-1' }) },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(collection.findOne).not.toHaveBeenCalled()
  })

  it('renames a list for an authenticated owner and scopes the update', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...list,
        name: 'Weeknight meals',
        updatedAt: '2026-09-10T12:01:00.000Z',
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  Weeknight meals  ' }),
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.name).toBe('Weeknight meals')
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'list-1',
        status: { $ne: 'deleted' },
        members: {
          $elemMatch: {
            userId: 'user-1',
            role: 'owner',
            invitationState: 'active',
          },
        },
      },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Weeknight meals' }),
      }),
      { returnDocument: 'after' },
    )
  })

  it('does not reveal a list to a non-owner', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = { findOne: vi.fn().mockResolvedValue(null) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Private rename' }),
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
  })

  it('does not let an editor archive a list', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(null),
      findOneAndUpdate: vi.fn(),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('archives a list through the owner-scoped status update', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...list,
        status: 'archived',
        updatedAt: '2026-09-10T12:02:00.000Z',
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.status).toBe('archived')
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'list-1', status: { $ne: 'deleted' } }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'archived' }),
      }),
      { returnDocument: 'after' },
    )
  })

  it('unarchives an archived list through the same owner-scoped update', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const archivedList = { ...list, status: 'archived' as const }
    const collection = {
      findOne: vi.fn().mockResolvedValue(archivedList),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...archivedList,
        status: 'active',
        updatedAt: '2026-09-10T12:03:00.000Z',
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.status).toBe('active')
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'list-1', status: { $ne: 'deleted' } }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'active' }),
      }),
      { returnDocument: 'after' },
    )
  })

  it('soft-deletes a list through the owner-scoped delete operation', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...list,
        status: 'deleted',
      }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(204)
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'list-1', status: { $ne: 'deleted' } }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'deleted' }),
      }),
      { returnDocument: 'after' },
    )
  })

  it('does not let an editor delete a list', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = { findOneAndUpdate: vi.fn().mockResolvedValue(null) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        members: {
          $elemMatch: {
            userId: 'editor-1',
            role: 'owner',
            invitationState: 'active',
          },
        },
      }),
      expect.anything(),
      { returnDocument: 'after' },
    )
  })
})
