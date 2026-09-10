import type { Db } from 'mongodb'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import {
  recipeShares,
  toRecipeDraft,
  type RecipeDraft,
  type RecipeDraftDocument,
  type RecipeShareDocument,
} from '@/lib/recipes/drafts'

export type RecipeLibraryAccess = 'owned' | 'shared'

export type RecipeLibraryEntry = {
  recipe: RecipeDraft
  access: RecipeLibraryAccess
  sharedListNames: string[]
}

/**
 * Returns the recipes a user can keep in their personal library today.
 *
 * Shared recipes are derived from current list membership at read time. This
 * keeps a removed member from retaining library access through a stale copy of
 * a recipe share.
 */
export async function findRecipeLibrary(
  db: Db,
  userId: string,
): Promise<RecipeLibraryEntry[]> {
  const memberLists = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(userId))
    .project({ _id: 1, name: 1 })
    .toArray()
  const listIds = memberLists.map((list) => list._id)

  const shares = listIds.length
    ? await recipeShares(db.collection<RecipeShareDocument>('recipe_shares'))
        .find({ listId: { $in: listIds } })
        .project({ recipeId: 1, listId: 1 })
        .toArray()
    : []
  const listNames = new Map(memberLists.map((list) => [list._id, list.name]))
  const sharedListsByRecipe = new Map<string, string[]>()
  for (const share of shares) {
    const listName = listNames.get(share.listId)
    if (!listName) continue
    const names = sharedListsByRecipe.get(share.recipeId) ?? []
    if (!names.includes(listName)) names.push(listName)
    sharedListsByRecipe.set(share.recipeId, names)
  }

  const sharedRecipeIds = [...sharedListsByRecipe.keys()]
  const recipes = await db
    .collection<RecipeDraftDocument>('recipes')
    .find({
      status: { $in: ['draft', 'usable'] as const },
      $or: [
        { ownerId: userId },
        ...(sharedRecipeIds.length
          ? [
              {
                _id: { $in: sharedRecipeIds },
                status: 'usable' as const,
                visibility: 'list-shared' as const,
              },
            ]
          : []),
      ],
    })
    .sort({ updatedAt: -1, _id: 1 })
    .toArray()

  return recipes.map((recipe) => {
    const sharedListNames = sharedListsByRecipe.get(recipe._id) ?? []
    return {
      recipe: toRecipeDraft(recipe),
      access:
        sharedListNames.length > 0 && recipe.ownerId !== userId
          ? 'shared'
          : 'owned',
      sharedListNames,
    }
  })
}
