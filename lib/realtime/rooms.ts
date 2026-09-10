import type { Db } from 'mongodb'
import { findListForMember } from '@/lib/lists'
import { createRealtimeEmitter } from '@/lib/realtime/events'

export type RealtimeRoomSocket = {
  join: (room: string) => void | Promise<void>
  emit: (event: string, payload: unknown) => unknown
}

export type RealtimeMembershipReader = (
  listId: string,
  userId: string,
) => Promise<{ _id: string } | null>

export type RealtimeHandshakeSocket = {
  handshake: { headers: { cookie?: string } }
}

export type RealtimeSessionReader = (
  headers: Headers,
) => Promise<{ user: { id: string } } | null>

export function realtimeListRoom(listId: string) {
  return `list:${listId}`
}

export function realtimeUserRoom(userId: string) {
  return `user:${userId}`
}

/**
 * Re-read the Better Auth session for a socket operation. A successful
 * handshake authenticates the connection, but it must not make a stale
 * session valid for later room joins.
 */
export async function authenticateRealtimeSocket(
  socket: RealtimeHandshakeSocket,
  readSession: RealtimeSessionReader,
) {
  const cookie = socket.handshake.headers.cookie
  if (!cookie) throw new Error('AUTHENTICATION_REQUIRED')

  const session = await readSession(new Headers({ cookie }))
  if (!session) throw new Error('AUTHENTICATION_REQUIRED')
  return session.user.id
}

export async function joinAuthenticatedUserRoom(
  socket: Pick<RealtimeRoomSocket, 'join'>,
  userId: string,
) {
  await socket.join(realtimeUserRoom(userId))
}

/**
 * Remove every connected socket for a user from one list room. The Mongo
 * adapter applies this across all realtime processes, so revocation does not
 * depend on which process accepted the membership change.
 */
export function revokeRealtimeListAccess(
  db: Db,
  listId: string,
  userId: string,
) {
  const emitter = createRealtimeEmitter(db)
  emitter.in(realtimeUserRoom(userId)).socketsLeave(realtimeListRoom(listId))
  emitter.in(realtimeUserRoom(userId)).emit('foundation:membership-revoked', {
    listId,
  })
}

export async function joinAuthorizedRealtimeRoom(
  socket: RealtimeRoomSocket,
  listId: unknown,
  userId: string,
  readMembership: RealtimeMembershipReader = findListForMember,
) {
  if (typeof listId !== 'string') {
    socket.emit('foundation:error', { code: 'LIST_ACCESS_DENIED' })
    return false
  }

  try {
    const list = await readMembership(listId, userId)
    if (!list) {
      socket.emit('foundation:error', { code: 'LIST_ACCESS_DENIED' })
      return false
    }

    await socket.join(realtimeListRoom(list._id))
    socket.emit('foundation:smoke', {
      revision: Date.now(),
      listId: list._id,
    })
    return true
  } catch {
    socket.emit('foundation:error', { code: 'AUTHORIZATION_UNAVAILABLE' })
    return false
  }
}
