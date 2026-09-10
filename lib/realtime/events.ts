import type { Db } from 'mongodb'
import { Emitter } from '@socket.io/mongo-emitter'
import { entityId, isoDateTime } from '@/lib/contracts/ids'
import type {
  RealtimeEvent,
  RealtimeRunMutationEvent,
} from '@/lib/contracts/mutations'

export function createRealtimeEmitter(db: Db) {
  return new Emitter(db.collection('socket.io-adapter-events'))
}

/**
 * The mutation event names are intentionally structural and content-free.
 * Clients use the revision to decide whether to apply a snapshot or request
 * recovery; the run remains the source of truth.
 */
export type RunMutationEventType = RealtimeRunMutationEvent['type']

type RunMutationEventInput = Omit<
  RealtimeRunMutationEvent,
  'listId' | 'runId' | 'occurredAt'
> & {
  listId: string
  runId: string
  now?: Date
}

/**
 * Persist and fan out an accepted active-run mutation. Callers deliberately
 * handle failures as best effort after the authoritative run write succeeds;
 * a realtime outage must not turn a committed grocery action into an error.
 */
export async function publishRunMutationEvent(
  db: Db,
  input: RunMutationEventInput,
): Promise<RealtimeRunMutationEvent> {
  const now = input.now ?? new Date()
  const event: RealtimeRunMutationEvent = {
    type: input.type,
    listId: entityId(input.listId),
    runId: entityId(input.runId),
    revision: input.revision,
    operationId: input.operationId,
    actorId: input.actorId,
    occurredAt: isoDateTime(now),
  }

  await db.collection('realtime_events').insertOne({
    ...event,
    createdAt: now,
  })
  createRealtimeEmitter(db)
    .in(`list:${input.listId}`)
    .emit('run:mutation', event)
  return event
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
