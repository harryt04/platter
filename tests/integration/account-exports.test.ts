import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Db } from 'mongodb'
import { GET as downloadExport } from '@/app/api/v1/account/exports/[exportId]/route'
import {
  createAccountExport,
  type AccountExportDocument,
} from '@/lib/account-exports'
import { isoDateTime } from '@/lib/contracts/ids'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type { ListDocument } from '@/lib/lists'
import type { RecipeImportDocument } from '@/lib/recipe-imports'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'
import type { RecipeSaveDocument } from '@/lib/recipes/saves'
import type { ShoppingRunHistoryDocument } from '@/lib/shopping-run-history'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))

const databaseName = process.env.MONGODB_DATABASE ?? ''
const fixtureToken = `platteraccountintegration${Date.now()}`
const ownerId = `${fixtureToken}-owner`
const otherUserId = `${fixtureToken}-other`
const ownerListId = `${fixtureToken}-owner-list`
const otherListId = `${fixtureToken}-other-list`
const ownerRecipeId = `${fixtureToken}-owner-recipe`
const otherRecipeId = `${fixtureToken}-other-recipe`
const ownerSaveId = `${fixtureToken}-owner-save`
const otherSaveId = `${fixtureToken}-other-save`
const ownerImportId = `${fixtureToken}-owner-import`
const otherImportId = `${fixtureToken}-other-import`
const ownerHistoryId = `${fixtureToken}-owner-history`
const otherHistoryId = `${fixtureToken}-other-history`
const timestamp = isoDateTime('2026-09-10T12:00:00.000Z')

const owner = {
  id: ownerId,
  name: 'Export Owner',
  email: `${ownerId}@example.test`,
  locale: 'fr-FR',
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
}

const otherUser = {
  id: otherUserId,
  name: 'Other Member',
  email: `${otherUserId}@example.test`,
  locale: 'en-US',
}

function listDocument(
  id: string,
  name: string,
  memberId: string,
): ListDocument {
  return {
    _id: id,
    name,
    ownerIds: [memberId],
    status: 'active',
    activeRunId: `${id}-run`,
    members: [{ userId: memberId, role: 'owner', invitationState: 'active' }],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function recipeDocument(id: string, recipeOwnerId: string) {
  return {
    _id: id,
    ownerId: recipeOwnerId,
    title: `${fixtureToken} recipe`,
    status: 'draft' as const,
    visibility: 'private' as const,
    ingredients: [],
    instructions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  } as RecipeDraftDocument
}

function importDocument(id: string, userId: string) {
  return {
    _id: id,
    userId,
    idempotencyKey: `${id}-request`,
    sourceUrl: `https://${id}.example.test/recipe`,
    status: 'failed' as const,
    attemptCount: 1,
    submittedAt: timestamp,
    updatedAt: timestamp,
  } as RecipeImportDocument
}

function historyDocument(
  id: string,
  listId: string,
  completedByUserId: string,
) {
  return {
    _id: id,
    listId,
    completedAt: timestamp,
    localDate: '2026-09-10',
    completedByUserId,
    recipeSelections: [],
  } as ShoppingRunHistoryDocument
}

describe('account export integration', () => {
  let db: Db
  const exportIds: string[] = []

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }

    db = await getConnectedDatabase()
    await db
      .collection<ListDocument>('lists')
      .insertMany([
        listDocument(ownerListId, `${fixtureToken} owner list`, ownerId),
        listDocument(otherListId, `${fixtureToken} other list`, otherUserId),
      ])
    await db
      .collection<RecipeDraftDocument>('recipes')
      .insertMany([
        recipeDocument(ownerRecipeId, ownerId),
        recipeDocument(otherRecipeId, otherUserId),
      ])
    await db.collection<RecipeSaveDocument>('recipe_saves').insertMany([
      {
        _id: ownerSaveId,
        userId: ownerId,
        recipeId: `${fixtureToken}-saved-public`,
        createdAt: timestamp,
      },
      {
        _id: otherSaveId,
        userId: otherUserId,
        recipeId: `${fixtureToken}-other-public`,
        createdAt: timestamp,
      },
    ])
    await db
      .collection<RecipeImportDocument>('recipe_imports')
      .insertMany([
        importDocument(ownerImportId, ownerId),
        importDocument(otherImportId, otherUserId),
      ])
    await db
      .collection<ShoppingRunHistoryDocument>('shopping_run_history')
      .insertMany([
        historyDocument(ownerHistoryId, ownerListId, ownerId),
        historyDocument(otherHistoryId, otherListId, otherUserId),
      ])
  })

  afterAll(async () => {
    if (!db) return
    await db
      .collection<AccountExportDocument>('account_exports')
      .deleteMany({ _id: { $in: exportIds } })
    await db
      .collection<ShoppingRunHistoryDocument>('shopping_run_history')
      .deleteMany({ _id: { $regex: `^${fixtureToken}` } })
    await db.collection<RecipeImportDocument>('recipe_imports').deleteMany({
      _id: { $regex: `^${fixtureToken}` },
    })
    await db
      .collection<RecipeSaveDocument>('recipe_saves')
      .deleteMany({ _id: { $regex: `^${fixtureToken}` } })
    await db
      .collection<RecipeDraftDocument>('recipes')
      .deleteMany({ _id: { $regex: `^${fixtureToken}` } })
    await db
      .collection<ListDocument>('lists')
      .deleteMany({ _id: { $regex: `^${fixtureToken}` } })
    await getMongoClient().close()
  })

  async function createStoredExport(
    user: typeof owner,
    now = new Date('2026-09-10T12:00:00.000Z'),
  ) {
    const document = await createAccountExport(db, user, now)
    await db
      .collection<AccountExportDocument>('account_exports')
      .insertOne(document)
    exportIds.push(document._id)
    return document
  }

  it('persists a locale-aware, owner-scoped export with the expected contents', async () => {
    const document = await createStoredExport(owner)

    expect(document.payload.account).toMatchObject({
      id: ownerId,
      email: owner.email,
      locale: 'fr-FR',
    })
    expect(document.payload.memberships).toEqual([
      {
        listId: ownerListId,
        listName: `${fixtureToken} owner list`,
        listStatus: 'active',
        role: 'owner',
      },
    ])
    expect(document.payload.recipes.map(({ id }) => id)).toEqual([
      ownerRecipeId,
    ])
    expect(document.payload.savedRecipes.map(({ _id }) => _id)).toEqual([
      ownerSaveId,
    ])
    expect(document.payload.imports.map(({ _id }) => _id)).toEqual([
      ownerImportId,
    ])
    expect(document.payload.imports[0]).not.toHaveProperty('idempotencyKey')
    expect(document.payload.history.map(({ _id }) => _id)).toEqual([
      ownerHistoryId,
    ])
    expect(JSON.stringify(document.payload)).not.toContain(otherUserId)
    expect(JSON.stringify(document.payload)).not.toContain(otherRecipeId)
  })

  it('allows the owner to download an unexpired export', async () => {
    const document = await createStoredExport(owner)
    getSession.mockResolvedValue({ user: owner })

    const response = await downloadExport(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: document._id }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(document.payload)
  })

  it('rejects cross-account and expired export downloads', async () => {
    const ownerDocument = await createStoredExport(owner)
    getSession.mockResolvedValue({ user: otherUser })

    const crossAccountResponse = await downloadExport(
      new Request('http://localhost'),
      { params: Promise.resolve({ exportId: ownerDocument._id }) },
    )
    expect(crossAccountResponse.status).toBe(404)

    const expiredDocument = await createStoredExport(
      owner,
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    )
    getSession.mockResolvedValue({ user: owner })
    const expiredResponse = await downloadExport(
      new Request('http://localhost'),
      { params: Promise.resolve({ exportId: expiredDocument._id }) },
    )
    expect(expiredResponse.status).toBe(404)
  })
})
