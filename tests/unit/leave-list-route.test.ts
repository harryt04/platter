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
  it('removes an active editor with a list-scoped atomic update', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = {
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
        members: {
          $elemMatch: {
            userId: 'editor-1',
            role: 'editor',
            invitationState: 'active',
          },
        },
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

  it('does not reveal a list to an owner or non-member', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = { findOneAndUpdate: vi.fn().mockResolvedValue(null) }
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
