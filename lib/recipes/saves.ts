import type { Collection } from 'mongodb'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'

export type RecipeSaveDocument = {
  _id: string
  userId: string
  recipeId: string
  createdAt: IsoDateTime
}

export function recipeSaves(collection: Collection<RecipeSaveDocument>) {
  return collection
}

export function createRecipeSaveDocument(
  userId: string,
  recipeId: string,
  now = new Date(),
): RecipeSaveDocument {
  return {
    _id: crypto.randomUUID(),
    userId,
    recipeId,
    createdAt: isoDateTime(now),
  }
}
