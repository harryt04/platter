import { z } from 'zod'
import type { Db } from 'mongodb'
import {
  isoDateTime,
  opaqueIdSchema,
  opaqueCursorSchema,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import {
  createRecipeSelectionDocument,
  type RecipeSelectionDocument,
} from '@/lib/recipes/selections'
import type { RecipeVersionDocument } from '@/lib/recipes/drafts'

/** The only recipe facts retained after an active run is completed. */
export type CompletedRecipeSelection = Pick<
  RecipeSelectionDocument,
  '_id' | 'recipeId' | 'versionId' | 'versionNumber' | 'desiredPeople'
>

/** Minimal, immutable history for one completed shopping run. */
export type ShoppingRunHistoryDocument = {
  _id: string
  listId: string
  completedAt: IsoDateTime
  localDate: string
  completedByUserId: string
  recipeSelections: CompletedRecipeSelection[]
}

export type ShoppingRunHistoryPage = {
  entries: ShoppingRunHistoryDocument[]
  nextCursor?: string
}

export type ShoppingRunHistorySearch = {
  cursor?: string
  pageSize?: number
}

export const historyIdSchema = opaqueIdSchema

const historyCursorSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedAt: z.string().datetime(),
  id: historyIdSchema,
})

const completedRecipeSelectionSchema = z
  .object({
    _id: opaqueIdSchema,
    recipeId: opaqueIdSchema,
    versionId: opaqueIdSchema,
    versionNumber: z.number().int().positive(),
    desiredPeople: z.number().int().positive().max(1000),
  })
  .strict()

/** Runtime boundary for minimal history documents read from MongoDB. */
export const shoppingRunHistoryDocumentSchema = z
  .object({
    _id: historyIdSchema,
    listId: opaqueIdSchema,
    completedAt: z.string().datetime(),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    completedByUserId: opaqueIdSchema,
    recipeSelections: z.array(completedRecipeSelectionSchema).max(1000),
  })
  .strict()

/** Runtime boundary for the list history API response. */
export const shoppingRunHistoryPageResponseSchema = z
  .object({
    history: z.array(shoppingRunHistoryDocumentSchema).max(1000),
    nextCursor: opaqueCursorSchema.optional(),
  })
  .strict()

export function encodeShoppingRunHistoryCursor(cursor: {
  localDate: string
  completedAt: string
  id: string
}) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodeShoppingRunHistoryCursor(value: string) {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const parsed = historyCursorSchema.safeParse(decoded)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Return one history entry only when it belongs to the already-authorized list. */
export async function findShoppingRunHistory(
  db: Db,
  listId: string,
  historyId: string,
) {
  if (!historyIdSchema.safeParse(historyId).success) return null
  return db
    .collection<ShoppingRunHistoryDocument>('shopping_run_history')
    .findOne({ _id: historyId, listId })
}

/**
 * Returns completed runs for one already-authorized list member.
 * localDate, completion time, and ID form a deterministic descending cursor.
 */
export async function searchShoppingRunHistory(
  db: Db,
  listId: string,
  options: ShoppingRunHistorySearch = {},
): Promise<ShoppingRunHistoryPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 50)
  const cursor = options.cursor
    ? decodeShoppingRunHistoryCursor(options.cursor)
    : null
  const cursorFilter = cursor
    ? {
        $or: [
          { localDate: { $lt: cursor.localDate } },
          {
            localDate: cursor.localDate,
            completedAt: { $lt: isoDateTime(cursor.completedAt) },
          },
          {
            localDate: cursor.localDate,
            completedAt: isoDateTime(cursor.completedAt),
            _id: { $lt: cursor.id },
          },
        ],
      }
    : undefined
  const documents = await db
    .collection<ShoppingRunHistoryDocument>('shopping_run_history')
    .find({ listId, ...(cursorFilter ?? {}) })
    .sort({ localDate: -1, completedAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .toArray()
  const hasNextPage = documents.length > pageSize
  const entries = hasNextPage ? documents.slice(0, pageSize) : documents
  const lastEntry = entries.at(-1)

  return {
    entries,
    ...(hasNextPage && lastEntry
      ? {
          nextCursor: encodeShoppingRunHistoryCursor({
            localDate: lastEntry.localDate,
            completedAt: lastEntry.completedAt,
            id: lastEntry._id,
          }),
        }
      : {}),
  }
}

export function formatShoppingRunHistoryDate(
  localDate: string,
  locale?: string,
) {
  const date = new Date(`${localDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return localDate
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

type ShoppingRunForHistory = {
  _id: string
  listId: string
  recipeSelections: RecipeSelectionDocument[]
}

export function createShoppingRunHistoryDocument(
  run: ShoppingRunForHistory,
  completedByUserId: string,
  localDate: string,
  now = new Date(),
): ShoppingRunHistoryDocument {
  return {
    _id: crypto.randomUUID(),
    listId: run.listId,
    completedAt: isoDateTime(now),
    localDate,
    completedByUserId,
    recipeSelections: run.recipeSelections.map(
      ({ _id, recipeId, versionId, versionNumber, desiredPeople }) => ({
        _id,
        recipeId,
        versionId,
        versionNumber,
        desiredPeople,
      }),
    ),
  }
}

/**
 * Rebuild one selection from the allowlisted facts retained in history.
 * Checklist state is deliberately not part of this boundary.
 */
export function createRepeatedRecipeSelection(
  reference: CompletedRecipeSelection,
  version: Pick<
    RecipeVersionDocument,
    '_id' | 'recipeId' | 'versionNumber' | 'typicalPeopleFed'
  >,
  now = new Date(),
): RecipeSelectionDocument {
  if (
    version._id !== reference.versionId ||
    version.recipeId !== reference.recipeId ||
    version.versionNumber !== reference.versionNumber
  ) {
    throw new Error('The historical recipe version does not match.')
  }

  return createRecipeSelectionDocument(version, reference.desiredPeople, now)
}
