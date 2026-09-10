import { describe, expect, it, vi } from 'vitest'
import {
  publishRunCompletionEvent,
  publishRunMutationEvent,
} from '@/lib/realtime/events'
import {
  realtimeRunCompletionEventSchema,
  realtimeRunMutationEventSchema,
} from '@/lib/contracts/mutations'

const { Emitter } = vi.hoisted(() => ({
  Emitter: vi.fn(),
}))

vi.mock('@socket.io/mongo-emitter', () => ({ Emitter }))

describe('realtime run mutation events', () => {
  it('accepts the content-free client event envelope and rejects extra content', () => {
    const event = {
      type: 'grocery.purchased.marked',
      listId: 'list-1',
      runId: 'run-1',
      revision: 7,
      operationId: 'operation-1',
      actorId: 'member-1',
      occurredAt: '2026-09-10T12:00:00.000Z',
    }

    expect(realtimeRunMutationEventSchema.safeParse(event).success).toBe(true)
    expect(
      realtimeRunMutationEventSchema.safeParse({ ...event, ingredient: 'rice' })
        .success,
    ).toBe(false)
  })

  it('persists and publishes a typed, content-free event to the list room', async () => {
    const insertOne = vi.fn().mockResolvedValue({ acknowledged: true })
    const emit = vi.fn()
    const inRoom = vi.fn().mockReturnValue({ emit })
    Emitter.mockImplementation(() => ({ in: inRoom }))
    const db = {
      collection: vi.fn().mockReturnValue({ insertOne }),
    } as never

    const event = await publishRunMutationEvent(db, {
      type: 'grocery.purchased.marked',
      listId: 'list-1',
      runId: 'run-1',
      revision: 7,
      operationId: 'operation-1',
      actorId: 'member-1',
      now: new Date('2026-09-10T12:00:00.000Z'),
    })

    expect(event).toEqual({
      type: 'grocery.purchased.marked',
      listId: 'list-1',
      runId: 'run-1',
      revision: 7,
      operationId: 'operation-1',
      actorId: 'member-1',
      occurredAt: '2026-09-10T12:00:00.000Z',
    })
    expect(insertOne).toHaveBeenCalledWith({
      ...event,
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
    })
    expect(inRoom).toHaveBeenCalledWith('list:list-1')
    expect(emit).toHaveBeenCalledWith('run:mutation', event)
  })

  it('accepts and publishes a completion handoff with the replacement run', async () => {
    const event = {
      type: 'run.completed',
      listId: 'list-1',
      runId: 'run-1',
      nextRunId: 'run-2',
      operationId: 'completion-1',
      completedByUserId: 'member-1',
      occurredAt: '2026-09-10T12:00:00.000Z',
    }
    expect(realtimeRunCompletionEventSchema.safeParse(event).success).toBe(true)

    const insertOne = vi.fn().mockResolvedValue({ acknowledged: true })
    const emit = vi.fn()
    const inRoom = vi.fn().mockReturnValue({ emit })
    Emitter.mockImplementation(() => ({ in: inRoom }))
    const db = {
      collection: vi.fn().mockReturnValue({ insertOne }),
    } as never

    await expect(
      publishRunCompletionEvent(db, {
        listId: 'list-1',
        runId: 'run-1',
        nextRunId: 'run-2',
        operationId: 'completion-1',
        completedByUserId: 'member-1',
        now: new Date('2026-09-10T12:00:00.000Z'),
      }),
    ).resolves.toEqual(event)
    expect(insertOne).toHaveBeenCalledWith({
      ...event,
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
    })
    expect(emit).toHaveBeenCalledWith('run:completed', event)
  })
})
