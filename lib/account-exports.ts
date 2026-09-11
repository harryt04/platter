import type { Db } from 'mongodb'
import { entityId, isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import type { RecipeDraft, RecipeDraftDocument } from '@/lib/recipes/drafts'
import { toRecipeDraftForViewer } from '@/lib/recipes/drafts'
import type { RecipeImportDocument } from '@/lib/recipe-imports'
import type { RecipeSaveDocument } from '@/lib/recipes/saves'
import type { ShoppingRunHistoryDocument } from '@/lib/shopping-run-history'

export const accountExportTtlHours = 24

export type AccountExportPayload = {
  format: 'platter-account-export'
  version: 1
  generatedAt: IsoDateTime
  account: {
    id: string
    name: string
    email: string
    locale: string
    createdAt?: IsoDateTime
  }
  memberships: Array<{
    listId: string
    listName: string
    listStatus: ListDocument['status']
    role: 'owner' | 'editor'
    joinedListAt?: IsoDateTime
  }>
  recipes: RecipeDraft[]
  savedRecipes: Array<
    Pick<RecipeSaveDocument, '_id' | 'recipeId' | 'createdAt'>
  >
  imports: Array<
    Omit<RecipeImportDocument, 'idempotencyKey' | 'preview'> & {
      preview?: RecipeImportDocument['preview']
    }
  >
  history: Array<
    Omit<ShoppingRunHistoryDocument, 'completedByUserId'> & {
      completedByCurrentUser: boolean
    }
  >
}

export type AccountExportDocument = {
  _id: string
  userId: string
  status: 'ready'
  payload: AccountExportPayload
  createdAt: IsoDateTime
  expiresAt: IsoDateTime
}

export type AccountExportSummary = {
  id: string
  status: AccountExportDocument['status']
  createdAt: IsoDateTime
  expiresAt: IsoDateTime
  downloadUrl: string
}

type ExportUser = {
  id: string
  name: string
  email: string
  locale?: string | null
  createdAt?: Date | string | null
}

function optionalIsoDateTime(value: Date | string | null | undefined) {
  return value ? isoDateTime(value) : undefined
}

function withoutImportIdempotencyKey(document: RecipeImportDocument) {
  const exportDocument = { ...document } as Omit<
    RecipeImportDocument,
    'idempotencyKey'
  >
  Reflect.deleteProperty(exportDocument, 'idempotencyKey')
  return exportDocument
}

function toSummary(document: AccountExportDocument): AccountExportSummary {
  return {
    id: entityId(document._id),
    status: document.status,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
    downloadUrl: `/api/v1/account/exports/${document._id}`,
  }
}

export function toAccountExportSummary(document: AccountExportDocument) {
  return toSummary(document)
}

/**
 * Build an export from allowlisted, user-scoped records. In particular, list
 * membership rows expose the caller's role but never serialize other members.
 */
export async function createAccountExport(
  db: Db,
  user: ExportUser,
  now = new Date(),
): Promise<AccountExportDocument> {
  const generatedAt = isoDateTime(now)
  const expiresAtDate = new Date(
    now.getTime() + accountExportTtlHours * 60 * 60 * 1000,
  )
  const expiresAt = isoDateTime(expiresAtDate)
  const lists = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(user.id))
    .sort({ _id: 1 })
    .toArray()
  const listIds = lists.map((list) => list._id)

  const [recipes, savedRecipes, imports, history] = await Promise.all([
    db
      .collection<RecipeDraftDocument>('recipes')
      .find({ ownerId: user.id })
      .sort({ _id: 1 })
      .toArray(),
    db
      .collection<RecipeSaveDocument>('recipe_saves')
      .find({ userId: user.id })
      .project({ _id: 1, recipeId: 1, createdAt: 1 })
      .sort({ _id: 1 })
      .toArray(),
    db
      .collection<RecipeImportDocument>('recipe_imports')
      .find({ userId: user.id })
      .sort({ _id: 1 })
      .toArray(),
    listIds.length === 0
      ? Promise.resolve([] as ShoppingRunHistoryDocument[])
      : db
          .collection<ShoppingRunHistoryDocument>('shopping_run_history')
          .find({ listId: { $in: listIds } })
          .sort({ completedAt: 1, _id: 1 })
          .toArray(),
  ])

  const payload: AccountExportPayload = {
    format: 'platter-account-export',
    version: 1,
    generatedAt,
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale ?? 'en-US',
      ...(optionalIsoDateTime(user.createdAt)
        ? { createdAt: optionalIsoDateTime(user.createdAt) }
        : {}),
    },
    memberships: lists.map((list) => {
      const membership = list.members.find(
        (member) => member.userId === user.id,
      )
      return {
        listId: list._id,
        listName: list.name,
        listStatus: list.status,
        role: membership?.role ?? 'editor',
      }
    }),
    recipes: recipes.map((recipe) => toRecipeDraftForViewer(recipe, 'owner')),
    savedRecipes: savedRecipes.map(({ _id, recipeId, createdAt }) => ({
      _id,
      recipeId,
      createdAt,
    })),
    imports: imports.map(withoutImportIdempotencyKey),
    history: history.map(({ completedByUserId, ...entry }) => ({
      ...entry,
      completedByCurrentUser: completedByUserId === user.id,
    })),
  }

  return {
    _id: crypto.randomUUID(),
    userId: user.id,
    status: 'ready',
    payload,
    createdAt: generatedAt,
    expiresAt,
  }
}

export function accountExportIsExpired(
  document: Pick<AccountExportDocument, 'expiresAt'>,
  now = new Date(),
) {
  return new Date(document.expiresAt).getTime() <= now.getTime()
}

export function isAccountExportId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}
