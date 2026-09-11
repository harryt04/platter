import { z } from 'zod'
import type { Db } from 'mongodb'
import { isoDateTime } from '@/lib/contracts/ids'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import {
  recipeShares,
  recipeDraftResponseSchema,
  toRecipeDraftForViewer,
  type RecipeDraft,
  type RecipeDraftDocument,
  type RecipeShareDocument,
} from '@/lib/recipes/drafts'
import { recipeSaves, type RecipeSaveDocument } from '@/lib/recipes/saves'

export type RecipeLibraryAccess = 'owned' | 'shared' | 'saved'

export type RecipeLibraryEntry = {
  recipe: RecipeDraft
  access: RecipeLibraryAccess
  sharedListNames: string[]
}

export type RecipeLibraryPage = {
  entries: RecipeLibraryEntry[]
  nextCursor?: string
}

/** Runtime boundary for the authenticated personal-library response. */
const recipeLibraryEntryResponseSchema = recipeDraftResponseSchema.extend({
  libraryAccess: z.enum(['owned', 'shared', 'saved']),
  sharedListNames: z.array(z.string().min(1).max(200)).max(50).optional(),
})

export const recipeLibraryPageResponseSchema = z.strictObject({
  recipes: z.array(recipeLibraryEntryResponseSchema).max(50),
  nextCursor: z.string().min(1).max(500).optional(),
})

export const recipeDraftCreationResponseSchema = z.strictObject({
  recipe: recipeDraftResponseSchema,
})

export type RecipeLibrarySearch = {
  text?: string
  cursor?: string
  pageSize?: number
}

const libraryCursorSchema = z.object({
  updatedAt: z.string().datetime(),
  id: z.string().min(1),
})

export function encodeRecipeLibraryCursor(cursor: {
  updatedAt: string
  id: string
}) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodeRecipeLibraryCursor(value: string) {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const parsed = libraryCursorSchema.safeParse(decoded)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

async function loadLibrarySources(db: Db, userId: string) {
  const memberLists = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(userId))
    .project({ _id: 1, name: 1 })
    .toArray()
  const listIds = memberLists.map((list) => list._id)
  const savedRecipes = await recipeSaves(
    db.collection<RecipeSaveDocument>('recipe_saves'),
  )
    .find({ userId })
    .project({ recipeId: 1 })
    .toArray()
  const savedRecipeIds = savedRecipes.map((save) => save.recipeId)

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

  return {
    savedRecipeIds,
    sharedRecipeIds: [...sharedListsByRecipe.keys()],
    sharedListsByRecipe,
  }
}

function toLibraryEntries(
  recipes: RecipeDraftDocument[],
  userId: string,
  savedRecipeIds: string[],
  sharedListsByRecipe: Map<string, string[]>,
) {
  return recipes.map((recipe) => {
    const sharedListNames = sharedListsByRecipe.get(recipe._id) ?? []
    const isSaved = savedRecipeIds.includes(recipe._id)
    const access =
      sharedListNames.length > 0 && recipe.ownerId !== userId
        ? 'shared'
        : isSaved && recipe.ownerId !== userId
          ? 'saved'
          : 'owned'
    return {
      recipe: toRecipeDraftForViewer(
        recipe,
        access === 'owned'
          ? 'owner'
          : access === 'shared'
            ? 'shared'
            : 'public',
      ),
      access,
      sharedListNames,
    } satisfies RecipeLibraryEntry
  })
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
  const { savedRecipeIds, sharedRecipeIds, sharedListsByRecipe } =
    await loadLibrarySources(db, userId)
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
        ...(savedRecipeIds.length
          ? [
              {
                _id: { $in: savedRecipeIds },
                status: 'usable' as const,
                visibility: 'public' as const,
                $or: [
                  { origin: { $exists: false } },
                  { origin: 'authored' as const },
                  {
                    origin: 'imported' as const,
                    importReviewStatus: 'approved' as const,
                  },
                ],
              },
            ]
          : []),
      ],
    })
    .sort({ updatedAt: -1, _id: 1 })
    .toArray()

  return toLibraryEntries(recipes, userId, savedRecipeIds, sharedListsByRecipe)
}

/**
 * Searches the current user's library without exposing recipes outside their
 * ownership, current list memberships, or saved public references. The
 * updatedAt/id cursor keeps pages stable when titles or source metadata match.
 */
export async function searchRecipeLibrary(
  db: Db,
  userId: string,
  options: RecipeLibrarySearch = {},
): Promise<RecipeLibraryPage> {
  const { savedRecipeIds, sharedRecipeIds, sharedListsByRecipe } =
    await loadLibrarySources(db, userId)
  const text = options.text?.trim() ?? ''
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 50)
  const decodedCursor = options.cursor
    ? decodeRecipeLibraryCursor(options.cursor)
    : null

  const accessFilter = [
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
    ...(savedRecipeIds.length
      ? [
          {
            _id: { $in: savedRecipeIds },
            status: 'usable' as const,
            visibility: 'public' as const,
            $or: [
              { origin: { $exists: false } },
              { origin: 'authored' as const },
              {
                origin: 'imported' as const,
                importReviewStatus: 'approved' as const,
              },
            ],
          },
        ]
      : []),
  ]
  const cursorFilter = decodedCursor
    ? {
        $or: [
          {
            updatedAt: { $lt: isoDateTime(decodedCursor.updatedAt) },
          },
          {
            updatedAt: isoDateTime(decodedCursor.updatedAt),
            _id: { $gt: decodedCursor.id },
          },
        ],
      }
    : undefined
  const filter = {
    status: { $in: ['draft', 'usable'] as const },
    ...(text ? { $text: { $search: text } } : {}),
    $and: [{ $or: accessFilter }, ...(cursorFilter ? [cursorFilter] : [])],
  }
  const documents = await db
    .collection<RecipeDraftDocument>('recipes')
    .find(filter)
    .sort({ updatedAt: -1, _id: 1 })
    .limit(pageSize + 1)
    .toArray()
  const hasNextPage = documents.length > pageSize
  const recipes = hasNextPage ? documents.slice(0, pageSize) : documents
  const lastRecipe = recipes.at(-1)

  return {
    entries: toLibraryEntries(
      recipes,
      userId,
      savedRecipeIds,
      sharedListsByRecipe,
    ),
    ...(hasNextPage && lastRecipe
      ? {
          nextCursor: encodeRecipeLibraryCursor({
            updatedAt: lastRecipe.updatedAt,
            id: lastRecipe._id,
          }),
        }
      : {}),
  }
}
