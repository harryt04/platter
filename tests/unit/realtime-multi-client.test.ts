import { createServer, type Server as HttpServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { io as createClient, type Socket } from 'socket.io-client'
import { createRealtimeApplication } from '@/lib/realtime/application'
import type { RealtimeRunMutationEvent } from '@/lib/contracts/mutations'
import { entityId, isoDateTime } from '@/lib/contracts/ids'

const listId = entityId('list-1')
const runId = entityId('run-1')

function mutation(
  overrides: Partial<RealtimeRunMutationEvent> = {},
): RealtimeRunMutationEvent {
  return {
    type: 'grocery.purchased.marked',
    listId,
    runId,
    revision: 1,
    operationId: 'operation-1',
    actorId: 'owner-1',
    occurredAt: isoDateTime('2026-09-10T12:00:00.000Z'),
    ...overrides,
  }
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('connect_error', onError)
      reject(new Error(`Timed out waiting for ${event}`))
    }, 2_000)
    const onError = (error: Error) => {
      clearTimeout(timeout)
      socket.off('connect_error', onError)
      reject(error)
    }
    socket.once('connect_error', onError)
    socket.once(event, (payload: T) => {
      clearTimeout(timeout)
      socket.off('connect_error', onError)
      resolve(payload)
    })
  })
}

async function listen(server: HttpServer) {
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Realtime test server did not expose a port')
  }
  return `http://127.0.0.1:${address.port}`
}

describe('realtime multi-client boundary', () => {
  let httpServer: HttpServer | undefined
  let realtime: ReturnType<typeof createRealtimeApplication> | undefined
  const clients: Socket[] = []
  const activeMembers = new Set(['owner-1', 'editor-1'])

  afterEach(async () => {
    for (const client of clients) client.disconnect()
    clients.length = 0
    if (realtime) {
      await new Promise<void>((resolve) => realtime?.close(() => resolve()))
      realtime = undefined
    }
    if (httpServer?.listening) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()))
    }
    httpServer = undefined
    serverUrl = undefined
    activeMembers.clear()
    activeMembers.add('owner-1')
    activeMembers.add('editor-1')
  })

  async function createTestServer() {
    httpServer = createServer()
    realtime = createRealtimeApplication(httpServer, {
      readSession: async (headers) => {
        const userId = headers.get('cookie')?.match(/platter-user=([^;]+)/)?.[1]
        return userId ? { user: { id: userId } } : null
      },
      readMembership: async (candidateListId, userId) =>
        candidateListId === listId && activeMembers.has(userId)
          ? { _id: listId }
          : null,
    })
    return listen(httpServer)
  }

  async function joinList(userId: string) {
    const url = await createTestServerOnce()
    const client = createClient(url, {
      extraHeaders: { cookie: `platter-user=${userId}` },
      reconnection: false,
    })
    clients.push(client)
    await waitForEvent<void>(client, 'connect')
    client.emit('foundation:join', listId)
    await waitForEvent<{ listId: string }>(client, 'foundation:smoke')
    return client
  }

  let serverUrl: string | undefined
  async function createTestServerOnce() {
    if (!serverUrl) serverUrl = await createTestServer()
    return serverUrl
  }

  it('fans out different-item and same-item mutations to both connected shoppers', async () => {
    const owner = await joinList('owner-1')
    const editor = await joinList('editor-1')
    const ownerEvents: RealtimeRunMutationEvent[] = []
    const editorEvents: RealtimeRunMutationEvent[] = []
    owner.on('run:mutation', (event: RealtimeRunMutationEvent) =>
      ownerEvents.push(event),
    )
    editor.on('run:mutation', (event: RealtimeRunMutationEvent) =>
      editorEvents.push(event),
    )

    const differentItemChange = mutation({
      operationId: 'different-item-operation',
      revision: 1,
    })
    const sameItemChange = mutation({
      type: 'grocery.purchased.undone',
      operationId: 'same-item-operation',
      revision: 2,
    })
    realtime?.to(`list:${listId}`).emit('run:mutation', differentItemChange)
    realtime?.to(`list:${listId}`).emit('run:mutation', sameItemChange)

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(ownerEvents).toEqual([differentItemChange, sameItemChange])
    expect(editorEvents).toEqual([differentItemChange, sameItemChange])
  })

  it('does not replay a disconnection gap and delivers the next authoritative event after reconnect', async () => {
    const owner = await joinList('owner-1')
    const editor = await joinList('editor-1')
    const ownerEvents: RealtimeRunMutationEvent[] = []
    const editorEvents: RealtimeRunMutationEvent[] = []
    owner.on('run:mutation', (event: RealtimeRunMutationEvent) =>
      ownerEvents.push(event),
    )
    editor.on('run:mutation', (event: RealtimeRunMutationEvent) =>
      editorEvents.push(event),
    )

    editor.disconnect()
    const missedEvent = mutation({ revision: 2, operationId: 'missed' })
    realtime?.to(`list:${listId}`).emit('run:mutation', missedEvent)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(ownerEvents).toEqual([missedEvent])
    expect(editorEvents).toEqual([])

    const reconnectedEditor = await joinList('editor-1')
    const nextEvent = mutation({ revision: 3, operationId: 'after-gap' })
    const receivedNextEvent = waitForEvent<RealtimeRunMutationEvent>(
      reconnectedEditor,
      'run:mutation',
    )
    realtime?.to(`list:${listId}`).emit('run:mutation', nextEvent)

    await expect(receivedNextEvent).resolves.toEqual(nextEvent)
  })

  it('rejects a removed member and a non-member when they attempt a new room join', async () => {
    const member = await joinList('editor-1')
    member.disconnect()
    activeMembers.delete('editor-1')

    const removedMember = await createClientForJoin('editor-1')
    await expect(
      waitForEvent<{ code: string }>(removedMember, 'foundation:error'),
    ).resolves.toEqual({ code: 'LIST_ACCESS_DENIED' })

    const outsider = await createClientForJoin('outsider-1')
    await expect(
      waitForEvent<{ code: string }>(outsider, 'foundation:error'),
    ).resolves.toEqual({ code: 'LIST_ACCESS_DENIED' })
  })

  async function createClientForJoin(userId: string) {
    const url = await createTestServerOnce()
    const client = createClient(url, {
      extraHeaders: { cookie: `platter-user=${userId}` },
      reconnection: false,
    })
    clients.push(client)
    await waitForEvent<void>(client, 'connect')
    client.emit('foundation:join', listId)
    return client
  }
})
