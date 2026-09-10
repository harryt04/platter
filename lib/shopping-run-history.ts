import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import type { RecipeSelectionDocument } from '@/lib/recipes/selections'

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
