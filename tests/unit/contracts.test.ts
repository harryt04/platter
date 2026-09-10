import { describe, expect, it, vi } from 'vitest'
import {
  createActiveShoppingRunDocument,
  createListDocument,
  createListSchema,
  listAcceptsShoppingOperations,
  listEditorFilter,
  listMemberFilter,
  listMembershipFilter,
  listOwnerFilter,
  updateListSchema,
} from '@/lib/lists'
import {
  authenticateRealtimeSocket,
  joinAuthenticatedUserRoom,
  joinAuthorizedRealtimeRoom,
  realtimeListRoom,
  revokeRealtimeListAccess,
  realtimeUserRoom,
} from '@/lib/realtime/rooms'

const { findListForMember, createRealtimeEmitter } = vi.hoisted(() => ({
  findListForMember: vi.fn(),
  createRealtimeEmitter: vi.fn(),
}))

vi.mock('@/lib/lists', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/lists')>('@/lib/lists')
  return { ...actual, findListForMember }
})
vi.mock('@/lib/realtime/events', () => ({ createRealtimeEmitter }))

describe('lists', () => {
  it('validates and trims names while rejecting blank or oversized values', () => {
    expect(createListSchema.parse({ name: '  Family  ' }).name).toBe('Family')
    expect(createListSchema.safeParse({ name: ' ' }).success).toBe(false)
    expect(createListSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(
      false,
    )
  })

  it('creates an owner membership and an empty active run', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    const run = createActiveShoppingRunDocument('list-1', now)
    const list = createListDocument('user-1', 'Family', run._id, now)

    expect(list).toMatchObject({
      name: 'Family',
      ownerIds: ['user-1'],
      status: 'active',
      activeRunId: run._id,
      members: [{ userId: 'user-1', role: 'owner', invitationState: 'active' }],
    })
    expect(run).toMatchObject({
      listId: 'list-1',
      state: 'active',
      revision: 0,
      recipeSelections: [],
      groceryItems: [],
      manualAdditions: [],
      ordering: [],
    })
  })

  it('scopes list reads to active membership and the requested list id', () => {
    expect(listMembershipFilter('user-1')).toEqual({
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: { userId: 'user-1', invitationState: 'active' },
      },
    })
    expect(listMemberFilter('list-1', 'user-1')).toEqual({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: { userId: 'user-1', invitationState: 'active' },
      },
    })
    expect(listOwnerFilter('list-1', 'user-1')).toEqual({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'user-1',
          role: 'owner',
          invitationState: 'active',
        },
      },
    })
    expect(listEditorFilter('list-1', 'editor-1')).toEqual({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'editor-1',
          role: 'editor',
          invitationState: 'active',
        },
      },
    })
  })

  it('validates renamed list names with the same contract as creation', () => {
    expect(updateListSchema.parse({ name: '  Weeknight meals  ' }).name).toBe(
      'Weeknight meals',
    )
    expect(updateListSchema.safeParse({ name: ' ' }).success).toBe(false)
  })

  it('allows shopping operations only for active lists', () => {
    expect(listAcceptsShoppingOperations({ status: 'active' })).toBe(true)
    expect(listAcceptsShoppingOperations({ status: 'archived' })).toBe(false)
    expect(listAcceptsShoppingOperations({ status: 'deleted' })).toBe(false)
  })
})
import { decimalString, entityId, isoDateTime } from '@/lib/contracts/ids'
import { problemSchema } from '@/lib/contracts/problem'
import { listIdSchema } from '@/lib/lists'
import {
  createInvitationDocument,
  hashInvitationToken,
} from '@/lib/invitations'

describe('foundation contracts', () => {
  it('keeps boundary values opaque and serializable', () => {
    expect(entityId('recipe-1')).toBe('recipe-1')
    expect(decimalString(2.5)).toBe('2.5')
    expect(isoDateTime('2026-09-10T00:00:00.000Z')).toBe(
      '2026-09-10T00:00:00.000Z',
    )
  })
  it('validates problem responses', () => {
    expect(
      problemSchema.parse({
        type: 'x',
        title: 'Nope',
        status: 400,
        detail: 'Bad input',
        code: 'BAD',
      }).code,
    ).toBe('BAD')
  })

  it('treats list ids as bounded, opaque route input', () => {
    expect(listIdSchema.safeParse('list-1').success).toBe(true)
    expect(listIdSchema.safeParse('').success).toBe(false)
    expect(listIdSchema.safeParse(`list-${'x'.repeat(100)}`).success).toBe(
      false,
    )
    expect(listIdSchema.safeParse('list-\u0000-1').success).toBe(false)
  })

  it('stores only a hash of an unguessable invitation token with an expiry', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    const { document, token } = createInvitationDocument(
      'list-1',
      'owner-1',
      'guest@example.com',
      now,
      24,
    )

    expect(token).toHaveLength(43)
    expect(document.tokenHash).toBe(hashInvitationToken(token))
    expect(document.tokenHash).not.toBe(token)
    expect(document).toMatchObject({
      listId: 'list-1',
      inviterId: 'owner-1',
      email: 'guest@example.com',
      status: 'pending',
      expiresAt: '2026-09-11T12:00:00.000Z',
    })
  })

  it('only joins realtime rooms for a current list member', async () => {
    const socket = {
      join: vi.fn(),
      emit: vi.fn(),
    }
    findListForMember.mockResolvedValueOnce(null)

    await expect(
      joinAuthorizedRealtimeRoom(socket, 'list-1', 'removed-user'),
    ).resolves.toBe(false)
    expect(socket.join).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('foundation:error', {
      code: 'LIST_ACCESS_DENIED',
    })

    findListForMember.mockResolvedValueOnce({ _id: 'list-1' })
    await expect(
      joinAuthorizedRealtimeRoom(socket, 'list-1', 'active-user'),
    ).resolves.toBe(true)
    expect(socket.join).toHaveBeenCalledWith('list:list-1')
    expect(socket.emit).toHaveBeenCalledWith(
      'foundation:smoke',
      expect.objectContaining({ listId: 'list-1' }),
    )
  })

  it('requires a current session cookie before a realtime operation', async () => {
    const socket = { handshake: { headers: {} } }
    const readSession = vi.fn()

    await expect(
      authenticateRealtimeSocket(socket, readSession),
    ).rejects.toThrow('AUTHENTICATION_REQUIRED')
    expect(readSession).not.toHaveBeenCalled()
  })

  it('revalidates the session identity from the handshake cookie', async () => {
    const socket = {
      handshake: { headers: { cookie: 'better-auth.session_token=token' } },
    }
    const readSession = vi.fn().mockResolvedValue({ user: { id: 'member-1' } })

    await expect(authenticateRealtimeSocket(socket, readSession)).resolves.toBe(
      'member-1',
    )
    expect(readSession).toHaveBeenCalledWith(
      new Headers({ cookie: 'better-auth.session_token=token' }),
    )
  })

  it('rejects a cookie whose session is no longer valid', async () => {
    const socket = {
      handshake: { headers: { cookie: 'better-auth.session_token=expired' } },
    }
    const readSession = vi.fn().mockResolvedValue(null)

    await expect(
      authenticateRealtimeSocket(socket, readSession),
    ).rejects.toThrow('AUTHENTICATION_REQUIRED')
  })

  it('uses a private user room to support cross-process membership revocation', async () => {
    const socket = { join: vi.fn() }

    await joinAuthenticatedUserRoom(socket, 'member-1')

    expect(socket.join).toHaveBeenCalledWith(realtimeUserRoom('member-1'))
    expect(realtimeListRoom('list-1')).toBe('list:list-1')
  })

  it('evicts a removed member from the list room across realtime processes', () => {
    const socketsLeave = vi.fn()
    const emit = vi.fn()
    const inRoom = vi.fn().mockReturnValue({ socketsLeave, emit })
    createRealtimeEmitter.mockReturnValue({ in: inRoom })

    revokeRealtimeListAccess({} as import('mongodb').Db, 'list-1', 'member-1')

    expect(inRoom).toHaveBeenCalledTimes(2)
    expect(inRoom).toHaveBeenNthCalledWith(1, realtimeUserRoom('member-1'))
    expect(socketsLeave).toHaveBeenCalledWith(realtimeListRoom('list-1'))
    expect(emit).toHaveBeenCalledWith('foundation:membership-revoked', {
      listId: 'list-1',
    })
  })
})
