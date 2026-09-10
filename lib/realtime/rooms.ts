import { findListForMember } from '@/lib/lists'

export type RealtimeRoomSocket = {
  join: (room: string) => void | Promise<void>
  emit: (event: string, payload: unknown) => unknown
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

    await socket.join(`list:${list._id}`)
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
