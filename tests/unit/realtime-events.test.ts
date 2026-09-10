import { describe, expect, it, vi } from 'vitest'
import { publishRunMutationEvent } from '@/lib/realtime/events'

const { Emitter } = vi.hoisted(() => ({
  Emitter: vi.fn(),
}))

vi.mock('@socket.io/mongo-emitter', () => ({ Emitter }))

describe('realtime run mutation events', () => {
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
})
