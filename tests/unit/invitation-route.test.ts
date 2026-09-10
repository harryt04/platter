import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/[listId]/invitations/route'

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
  ],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function context(listId: string) {
  return { params: Promise.resolve({ listId }) }
}

describe('POST /api/v1/lists/[listId]/invitations', () => {
  it('requires authentication without querying the database', async () => {
    getSession.mockResolvedValue(null)
    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('does not query for malformed list ids', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-%00-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-\u0000-1'),
    )

    expect(response.status).toBe(404)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('hides invitations from editors and non-members', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = { findOne: vi.fn().mockResolvedValue(null) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(collection.findOne).toHaveBeenCalledWith({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'editor-1',
          role: 'owner',
          invitationState: 'active',
        },
      },
    })
  })

  it('validates the recipient email before creating an invitation', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
  })

  it('creates a pending invitation with a shareable URL and hashed token', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: '  Guest@Example.com ' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.invitation).toMatchObject({
      listId: 'list-1',
      email: 'guest@example.com',
      status: 'pending',
    })
    const token = body.invitation.inviteUrl.split('/').at(-1)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const stored = collection.insertOne.mock.calls[0][0]
    expect(stored).toMatchObject({
      listId: 'list-1',
      inviterId: 'owner-1',
      email: 'guest@example.com',
      status: 'pending',
    })
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    )
    expect(stored).not.toHaveProperty('token')
  })
})
