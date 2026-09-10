import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/lists/[listId]/members/route'
import {
  DELETE,
  PATCH,
} from '@/app/api/v1/lists/[listId]/members/[memberId]/route'

const { getSession, findListForRole, getConnectedDatabase } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    findListForRole: vi.fn(),
    getConnectedDatabase: vi.fn(),
  }),
)

vi.mock('@/lib/auth/authorization', () => ({ getSession, findListForRole }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

afterEach(() => {
  vi.clearAllMocks()
})

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

function context(memberId = 'editor-1', listId = 'list-1') {
  return { params: Promise.resolve({ listId, memberId }) }
}

describe('member management routes', () => {
  it('lists active members only to an owner', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    findListForRole.mockResolvedValue({ list, member: list.members[0] })

    const response = await GET(
      new Request('http://localhost/api/v1/lists/list-1/members'),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ members: list.members })
    expect(findListForRole).toHaveBeenCalledWith('list-1', 'owner-1', ['owner'])
  })

  it('requires authentication before looking up a member', async () => {
    getSession.mockResolvedValue(null)

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1/members/editor-1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'owner' }),
      }),
      context(),
    )

    expect(response.status).toBe(401)
    expect(findListForRole).not.toHaveBeenCalled()
  })

  it('hides member management from editors', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    findListForRole.mockResolvedValue(null)

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1/members/editor-1', {
        method: 'DELETE',
      }),
      context(),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(findListForRole).toHaveBeenCalledWith('list-1', 'editor-1', [
      'owner',
    ])
  })

  it('promotes an editor while keeping owner ids and members in sync', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    findListForRole.mockResolvedValue({
      list,
      member: list.members[0],
    })
    const updated = {
      ...list,
      ownerIds: ['owner-1', 'editor-1'],
      members: list.members.map((member) =>
        member.userId === 'editor-1'
          ? { ...member, role: 'owner' as const }
          : member,
      ),
    }
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(updated),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1/members/editor-1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'owner' }),
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).member).toMatchObject({
      userId: 'editor-1',
      role: 'owner',
    })
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'list-1',
        updatedAt: list.updatedAt,
        $and: [
          expect.objectContaining({
            members: {
              $elemMatch: expect.objectContaining({
                userId: 'editor-1',
                role: 'editor',
              }),
            },
          }),
        ],
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          ownerIds: ['owner-1', 'editor-1'],
        }),
      }),
      { returnDocument: 'after' },
    )
  })

  it('does not allow the last owner to be demoted', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    findListForRole.mockResolvedValue({ list, member: list.members[0] })

    const response = await PATCH(
      new Request('http://localhost/api/v1/lists/list-1/members/owner-1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'editor' }),
      }),
      context('owner-1'),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('LAST_OWNER_REQUIRED')
  })

  it('removes only an editor with an owner-scoped compare-and-set update', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    findListForRole.mockResolvedValue({ list, member: list.members[0] })
    const updated = { ...list, members: [list.members[0]] }
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(updated),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1/members/editor-1', {
        method: 'DELETE',
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.members).toHaveLength(1)
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'list-1',
        updatedAt: list.updatedAt,
      }),
      expect.objectContaining({
        $pull: { members: { userId: 'editor-1' } },
      }),
      { returnDocument: 'after' },
    )
  })

  it('does not remove an owner through the editor-removal endpoint', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    findListForRole.mockResolvedValue({ list, member: list.members[0] })

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1/members/owner-1', {
        method: 'DELETE',
      }),
      context('owner-1'),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('MEMBER_NOT_FOUND')
  })
})
