import type { Db } from 'mongodb'
import { Emitter } from '@socket.io/mongo-emitter'
import type { RealtimeEvent } from '@/lib/contracts/mutations'

export function createRealtimeEmitter(db: Db) {
  return new Emitter(db.collection('socket.io-adapter-events'))
}

export async function recordSmokeEvent(
  db: Db,
  listId: string,
): Promise<RealtimeEvent> {
  const event: RealtimeEvent = {
    type: 'foundation.smoke',
    listId: listId as RealtimeEvent['listId'],
    revision: Date.now(),
    occurredAt: new Date().toISOString() as RealtimeEvent['occurredAt'],
  }
  await db
    .collection('realtime_events')
    .insertOne({ ...event, createdAt: new Date() })
  return event
}
