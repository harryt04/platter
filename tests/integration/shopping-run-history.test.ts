import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Db } from 'mongodb'
import { POST as completeShoppingRun } from '@/app/api/v1/lists/[listId]/complete/route'
import { GET as getShoppingRunHistory } from '@/app/api/v1/lists/[listId]/history/route'
import { POST as repeatShoppingRun } from '@/app/api/v1/lists/[listId]/history/[runId]/repeat/route'
import { POST as createList } from '@/app/api/v1/lists/route'
import { isoDateTime } from '@/lib/contracts/ids'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  createDraftDocument,
  createRecipeVersionDocument,
  type RecipeDraftDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import { createRecipeSelectionDocument } from '@/lib/recipes/selections'
import {
  resolveRunRecipeVersions,
  type PinnedRecipeVersionReference,
} from '@/lib/recipes/versions'
import type { ListDocument, ShoppingRunDocument } from '@/lib/lists'
import type { ShoppingRunHistoryDocument } from '@/lib/shopping-run-history'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))

const databaseName = process.env.MONGODB_DATABASE ?? ''
const fixtureToken = `platterhistoryintegration${Date.now()}`
const ownerId = `${fixtureToken}-owner`
const outsiderId = `${fixtureToken}-outsider`

function session(userId: string) {
  return { user: { id: userId } }
}

function listContext(listId: string) {
  return { params: Promise.resolve({ listId }) }
}

function repeatContext(listId: string, historyId: string) {
  return { params: Promise.resolve({ listId, runId: historyId }) }
}

describe('Mongo-backed shopping history workflow', () => {
  let db: Db
  let listId: string
  let recipeId: string
  let historyId: string
  let activeRunId: string

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }

    db = await getConnectedDatabase()
  })

  afterAll(async () => {
    if (!db) return
    if (listId) {
      await db.collection<ListDocument>('lists').deleteMany({ _id: listId })
      await db
        .collection<ShoppingRunDocument>('shopping_runs')
        .deleteMany({ listId })
      await db
        .collection<ShoppingRunHistoryDocument>('shopping_run_history')
        .deleteMany({ listId })
    }
    if (recipeId) {
      await db
        .collection<RecipeDraftDocument>('recipes')
        .deleteMany({ _id: recipeId })
      await db
        .collection<RecipeVersionDocument>('recipe_versions')
        .deleteMany({ recipeId })
    }
  })

  it('resolves historical versions, protects list boundaries, and repeats a run', async () => {
    getSession.mockReturnValue(session(ownerId))

    const listResponse = await createList(
      new Request('http://localhost/api/v1/lists', {
        method: 'POST',
        body: JSON.stringify({ name: `${fixtureToken} history` }),
      }),
    )
    expect(listResponse.status).toBe(201)
    const listBody = (await listResponse.json()) as {
      list: { id: string; activeRunId: string }
    }
    listId = listBody.list.id
    activeRunId = listBody.list.activeRunId

    const recipe = createDraftDocument(
      ownerId,
      `${fixtureToken} historical tacos`,
      {
        typicalPeopleFed: 4,
        ingredients: [
          {
            originalText: '1 lime',
            quantity: '1',
            unit: 'each',
            ingredientName: 'lime',
            preparationNote: '',
            optional: false,
          },
        ],
      },
    )
    const version = createRecipeVersionDocument(recipe)
    recipeId = recipe._id
    await db.collection<RecipeDraftDocument>('recipes').insertOne(recipe)
    await db
      .collection<RecipeVersionDocument>('recipe_versions')
      .insertOne(version)

    const selection = createRecipeSelectionDocument(recipe, 6)
    await db.collection<ShoppingRunDocument>('shopping_runs').updateOne(
      { _id: activeRunId, listId },
      {
        $set: {
          recipeSelections: [selection],
          revision: 1,
          updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
        },
      },
    )

    const completion = await completeShoppingRun(
      new Request(`http://localhost/api/v1/lists/${listId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          runId: activeRunId,
          operationId: `${fixtureToken}-complete`,
          clientId: `${fixtureToken}-client`,
          baseRevision: 1,
          localDate: '2026-09-09',
        }),
      }),
      listContext(listId),
    )
    expect(completion.status).toBe(200)
    const completionBody = (await completion.json()) as {
      historyId: string
      activeRunId: string
    }
    historyId = completionBody.historyId
    activeRunId = completionBody.activeRunId

    await db
      .collection<RecipeDraftDocument>('recipes')
      .updateOne(
        { _id: recipeId },
        { $set: { title: `${fixtureToken} newer tacos` } },
      )

    const historyResponse = await getShoppingRunHistory(
      new Request(`http://localhost/api/v1/lists/${listId}/history`),
      listContext(listId),
    )
    expect(historyResponse.status).toBe(200)
    const historyBody = (await historyResponse.json()) as {
      history: ShoppingRunHistoryDocument[]
    }
    expect(historyBody.history).toHaveLength(1)
    expect(historyBody.history[0]).toMatchObject({
      _id: historyId,
      localDate: '2026-09-09',
      completedByUserId: ownerId,
      recipeSelections: [
        {
          recipeId,
          versionId: version._id,
          versionNumber: 1,
          desiredPeople: 6,
        },
      ],
    })

    const resolved = await resolveRunRecipeVersions(
      db,
      historyBody.history[0]!
        .recipeSelections as PinnedRecipeVersionReference[],
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.version).toMatchObject({
      _id: version._id,
      title: `${fixtureToken} historical tacos`,
    })

    getSession.mockReturnValue(session(outsiderId))
    const outsiderHistory = await getShoppingRunHistory(
      new Request(`http://localhost/api/v1/lists/${listId}/history`),
      listContext(listId),
    )
    expect(outsiderHistory.status).toBe(404)
    const outsiderRepeat = await repeatShoppingRun(
      new Request(
        `http://localhost/api/v1/lists/${listId}/history/${historyId}/repeat`,
        {
          method: 'POST',
          body: JSON.stringify({
            operationId: `${fixtureToken}-outsider-repeat`,
            clientId: `${fixtureToken}-outsider-client`,
            runId: activeRunId,
            baseRevision: 0,
          }),
        },
      ),
      repeatContext(listId, historyId),
    )
    expect(outsiderRepeat.status).toBe(404)

    getSession.mockReturnValue(session(ownerId))
    const repeatRequestBody = {
      operationId: `${fixtureToken}-repeat`,
      clientId: `${fixtureToken}-repeat-client`,
      runId: activeRunId,
      baseRevision: 0,
    }
    const repeated = await repeatShoppingRun(
      new Request(
        `http://localhost/api/v1/lists/${listId}/history/${historyId}/repeat`,
        {
          method: 'POST',
          body: JSON.stringify(repeatRequestBody),
        },
      ),
      repeatContext(listId, historyId),
    )
    expect(repeated.status).toBe(200)
    const repeatedBody = (await repeated.json()) as {
      addedCount: number
      selections: Array<{
        recipeId: string
        versionId: string
        desiredPeople: number
        scaleFactor: string
      }>
    }
    expect(repeatedBody).toMatchObject({
      historyId,
      addedCount: 1,
      selections: [
        {
          recipeId,
          versionId: version._id,
          desiredPeople: 6,
          scaleFactor: '1.5',
        },
      ],
    })

    const currentRun = await db
      .collection<ShoppingRunDocument>('shopping_runs')
      .findOne({ _id: activeRunId, listId })
    expect(currentRun).toMatchObject({
      revision: 1,
      groceryItems: [],
      manualAdditions: [],
      ordering: [],
    })
    expect(currentRun?.recipeSelections).toHaveLength(1)

    const retry = await repeatShoppingRun(
      new Request(
        `http://localhost/api/v1/lists/${listId}/history/${historyId}/repeat`,
        {
          method: 'POST',
          body: JSON.stringify(repeatRequestBody),
        },
      ),
      repeatContext(listId, historyId),
    )
    expect(retry.status).toBe(200)
    expect(await retry.json()).toEqual(repeatedBody)
    expect(
      (
        await db
          .collection<ShoppingRunDocument>('shopping_runs')
          .findOne({ _id: activeRunId, listId })
      )?.recipeSelections,
    ).toHaveLength(1)
  })
})
