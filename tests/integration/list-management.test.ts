import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Db } from 'mongodb'
import { DELETE, PATCH } from '@/app/api/v1/lists/[listId]/route'
import { GET, POST } from '@/app/api/v1/lists/route'
import { isoDateTime } from '@/lib/contracts/ids'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import type { ListDocument, ShoppingRunDocument } from '@/lib/lists'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))

const databaseName = process.env.MONGODB_DATABASE ?? ''
const fixtureToken = `platterlistintegration${Date.now()}`
const ownerId = `${fixtureToken}-owner`
const editorId = `${fixtureToken}-editor`
const outsiderId = `${fixtureToken}-outsider`

function session(userId: string) {
  return { user: { id: userId } }
}

function listContext(listId: string) {
  return { params: Promise.resolve({ listId }) }
}

describe('Mongo-backed list management workflow', () => {
  let db: Db
  const createdListIds: string[] = []

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }

    db = await getConnectedDatabase()
    const indexes = await db.collection('shopping_runs').listIndexes().toArray()
    const hasActiveRunUniqueness = indexes.some(
      (index) =>
        index.unique === true &&
        index.key?.listId === 1 &&
        index.key?.state === 1 &&
        index.partialFilterExpression?.state === 'active',
    )
    if (!hasActiveRunUniqueness) {
      await db.collection('shopping_runs').createIndex(
        { listId: 1, state: 1 },
        {
          unique: true,
          partialFilterExpression: { state: 'active' },
        },
      )
    }
  })

  afterAll(async () => {
    if (!db) return
    await db.collection<ListDocument>('lists').deleteMany({
      _id: { $in: createdListIds },
    })
    await db.collection<ShoppingRunDocument>('shopping_runs').deleteMany({
      listId: { $in: createdListIds },
    })
  })

  it('creates three isolated lists with one active run each', async () => {
    getSession.mockReturnValue(session(ownerId))
    const names = ['Family', 'Weekend guests', 'Personal']

    for (const name of names) {
      const response = await POST(
        new Request('http://localhost/api/v1/lists', {
          method: 'POST',
          body: JSON.stringify({ name: `${fixtureToken} ${name}` }),
        }),
      )
      expect(response.status).toBe(201)
      const body = (await response.json()) as {
        list: { id: string; ownerIds: string[]; activeRunId: string }
        activeRunId: string
      }
      createdListIds.push(body.list.id)
      expect(body.list.ownerIds).toEqual([ownerId])
      expect(body.list.activeRunId).toBe(body.activeRunId)
    }

    const response = await GET()
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      lists: Array<{ id: string; name: string }>
    }
    expect(body.lists).toHaveLength(3)
    expect(body.lists.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        `${fixtureToken} Family`,
        `${fixtureToken} Weekend guests`,
        `${fixtureToken} Personal`,
      ]),
    )

    const runs = await db
      .collection<ShoppingRunDocument>('shopping_runs')
      .find({ listId: { $in: createdListIds }, state: 'active' })
      .toArray()
    expect(runs).toHaveLength(3)
    expect(new Set(runs.map((run) => run.listId)).size).toBe(3)
    expect(runs.every((run) => run.recipeSelections.length === 0)).toBe(true)
  })

  it('keeps list access and owner lifecycle operations scoped', async () => {
    const [firstListId, secondListId] = createdListIds
    expect(firstListId).toBeDefined()
    expect(secondListId).toBeDefined()

    await db.collection<ListDocument>('lists').updateOne(
      { _id: firstListId },
      {
        $push: {
          members: {
            userId: editorId,
            role: 'editor',
            invitationState: 'active',
          },
        },
      },
    )

    getSession.mockReturnValue(session(editorId))
    const editorLists = await GET()
    const editorListBody = (await editorLists.json()) as {
      lists: Array<{ id: string }>
    }
    expect(editorListBody.lists).toHaveLength(1)
    expect(editorListBody.lists[0]?.id).toBe(firstListId)

    const editorArchive = await PATCH(
      new Request(`http://localhost/api/v1/lists/${firstListId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      }),
      listContext(firstListId),
    )
    expect(editorArchive.status).toBe(404)

    getSession.mockReturnValue(session(ownerId))
    const archive = await PATCH(
      new Request(`http://localhost/api/v1/lists/${firstListId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      }),
      listContext(firstListId),
    )
    expect(((await archive.json()) as { list: ListDocument }).list.status).toBe(
      'archived',
    )

    const unarchive = await PATCH(
      new Request(`http://localhost/api/v1/lists/${firstListId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }),
      listContext(firstListId),
    )
    expect(
      ((await unarchive.json()) as { list: ListDocument }).list.status,
    ).toBe('active')

    getSession.mockReturnValue(session(outsiderId))
    const outsiderLists = await GET()
    expect(
      ((await outsiderLists.json()) as { lists: unknown[] }).lists,
    ).toEqual([])

    getSession.mockReturnValue(session(ownerId))
    const deletion = await DELETE(
      new Request(`http://localhost/api/v1/lists/${secondListId}`, {
        method: 'DELETE',
      }),
      listContext(secondListId),
    )
    expect(deletion.status).toBe(204)
  })

  it('enforces one active run per list at the database boundary', async () => {
    const listId = createdListIds[0]
    const list = await db
      .collection<ListDocument>('lists')
      .findOne({ _id: listId })
    expect(list?.activeRunId).toBeDefined()

    await expect(
      db.collection<ShoppingRunDocument>('shopping_runs').insertOne({
        _id: `${fixtureToken}-duplicate-run`,
        listId,
        state: 'active',
        revision: 0,
        recipeSelections: [],
        groceryItems: [],
        manualAdditions: [],
        ordering: [],
        createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
        updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/duplicate key|E11000/i)
  })
})
