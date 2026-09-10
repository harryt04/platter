import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import {
  ownedRecipeFilter,
  publicRecipeFilter,
  type RecipeDraftDocument,
  type RecipeShareDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import { acceptNewerRecipeVersion } from '@/lib/recipes/selections'
import { calculateScaledIngredients } from '@/lib/recipes/scaling'

type RouteContext = {
  params: Promise<{ listId: string; selectionId: string }>
}

const selectionIdSchema = listIdSchema

function problem(
  code: string,
  title: string,
  status: 401 | 404 | 409,
  detail: string,
) {
  return problemResponse({
    type: `https://platter.dev/problems/${code.toLowerCase()}`,
    title,
    status,
    detail,
    code,
  })
}

async function findAccessibleCurrentRecipe(
  db: Awaited<ReturnType<typeof getConnectedDatabase>>,
  recipeId: string,
  listId: string,
  userId: string,
) {
  const recipes = db.collection<RecipeDraftDocument>('recipes')
  const owned = await recipes.findOne({
    ...ownedRecipeFilter(userId, recipeId),
    status: 'usable',
  })
  if (owned) return owned

  const publicRecipe = await recipes.findOne(publicRecipeFilter(recipeId))
  if (publicRecipe) return publicRecipe

  const share = await db
    .collection<RecipeShareDocument>('recipe_shares')
    .findOne({ recipeId, listId })
  if (!share) return null

  return recipes.findOne({
    _id: recipeId,
    status: 'usable',
    visibility: 'list-shared',
  })
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) {
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      401,
      'Sign in to review and accept a newer recipe version.',
    )
  }

  const { listId, selectionId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !selectionIdSchema.safeParse(selectionId).success
  ) {
    return problem(
      'SELECTION_NOT_FOUND',
      'Recipe selection not found',
      404,
      'That recipe selection is not available to you.',
    )
  }

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, session.user.id))
  if (!list) {
    return problem(
      'LIST_NOT_FOUND',
      'List not found',
      404,
      'That list is not available to you.',
    )
  }
  if (list.status !== 'active') {
    return problem(
      'LIST_NOT_ACTIVE',
      'List is archived',
      409,
      'Unarchive this list before accepting a recipe update.',
    )
  }

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const currentRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  const selection = currentRun?.recipeSelections.find(
    (candidate) => candidate._id === selectionId,
  )
  if (!currentRun || !selection) {
    return problem(
      'SELECTION_NOT_FOUND',
      'Recipe selection not found',
      404,
      'That recipe selection is not in this shopping run.',
    )
  }

  const recipe = await findAccessibleCurrentRecipe(
    db,
    selection.recipeId,
    listId,
    session.user.id,
  )
  const currentVersionId = recipe?.versionId ?? recipe?._id
  const currentVersionNumber = recipe?.versionNumber ?? 1
  if (
    !recipe ||
    currentVersionNumber <= selection.versionNumber ||
    !currentVersionId
  ) {
    return problem(
      'NO_NEWER_RECIPE_VERSION',
      'No newer recipe version',
      409,
      'This selection is already using the latest accessible recipe version.',
    )
  }

  const version = await db
    .collection<RecipeVersionDocument>('recipe_versions')
    .findOne({
      _id: currentVersionId,
      recipeId: selection.recipeId,
      versionNumber: currentVersionNumber,
      status: 'usable',
    })
  if (!version) {
    return problem(
      'RECIPE_VERSION_UNAVAILABLE',
      'Recipe version unavailable',
      409,
      'That newer recipe version is not ready to use in a shopping run.',
    )
  }

  const updatedSelection = acceptNewerRecipeVersion(selection, version)
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      'recipeSelections._id': selectionId,
      'recipeSelections.versionId': selection.versionId,
      'recipeSelections.versionNumber': selection.versionNumber,
    },
    {
      $set: {
        'recipeSelections.$': updatedSelection,
        updatedAt: updatedSelection.updatedAt,
      },
      $inc: { revision: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!updatedRun) {
    return problem(
      'SELECTION_CHANGED',
      'Selection changed elsewhere',
      409,
      'Reload the list before accepting this recipe update.',
    )
  }

  return Response.json({
    selection: updatedSelection,
    previousVersionNumber: selection.versionNumber,
    recipe: {
      id: selection.recipeId,
      title: recipe.title,
      versionId: updatedSelection.versionId,
      versionNumber: updatedSelection.versionNumber,
    },
    calculatedIngredients: calculateScaledIngredients(
      version.ingredients ?? [],
      updatedSelection.scaleFactor,
    ),
    revision: updatedRun.revision,
  })
}
