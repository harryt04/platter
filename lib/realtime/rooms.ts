import type { Db } from 'mongodb'
import { findListForMember } from '@/lib/lists'
import { createRealtimeEmitter } from '@/lib/realtime/events'

export type RealtimeRoomSocket = {
  join: (room: string) => void | Promise<void>
  emit: (event: string, payload: unknown) => unknown
}

export function realtimeListRoom(listId: string) {
  return `list:${listId}`
}

export function realtimeUserRoom(userId: string) {
  return `user:${userId}`
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
) {
  if (typeof listId !== 'string') {
    socket.emit('foundation:error', { code: 'LIST_ACCESS_DENIED' })
    return false
  }

  try {
    const list = await findListForMember(listId, userId)
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
