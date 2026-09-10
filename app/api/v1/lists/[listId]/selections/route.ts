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
import {
  createRecipeSelectionDocument,
  createRecipeSelectionSchema,
} from '@/lib/recipes/selections'
import { calculateScaledIngredients } from '@/lib/recipes/scaling'

type RouteContext = { params: Promise<{ listId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to add a recipe to a shopping run.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function listNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-found',
    title: 'List not found',
    status: 404,
    detail: 'That list is not available to you.',
    code: 'LIST_NOT_FOUND',
  })
}

function recipeNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-not-found',
    title: 'Recipe not found',
    status: 404,
    detail: 'That recipe is not available to you.',
    code: 'RECIPE_NOT_FOUND',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send a recipe id and the number of people it should feed.',
    code: 'INVALID_JSON',
  })
}

function validationFailed(fields: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the recipe selection',
    status: 422,
    detail: 'Choose a usable recipe and a positive whole number of people.',
    code: 'VALIDATION_FAILED',
    fields,
  })
}

function archivedList() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-active',
    title: 'List is archived',
    status: 409,
    detail: 'Unarchive this list before adding a recipe to its shopping run.',
    code: 'LIST_NOT_ACTIVE',
  })
}

function versionUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-version-unavailable',
    title: 'Recipe version unavailable',
    status: 409,
    detail: 'That recipe version is not ready to add to a shopping run.',
    code: 'RECIPE_VERSION_UNAVAILABLE',
  })
}

async function findAccessibleRecipe(
  listId: string,
  recipeId: string,
  userId: string,
  db: Awaited<ReturnType<typeof getConnectedDatabase>>,
) {
  const recipes = db.collection<RecipeDraftDocument>('recipes')
  const owned = await recipes.findOne({
    ...ownedRecipeFilter(userId, recipeId),
    status: 'usable',
  })
  if (owned) return owned

  const share = await db
    .collection<RecipeShareDocument>('recipe_shares')
    .findOne({ recipeId, listId })
  if (share) {
    const shared = await recipes.findOne({
      _id: recipeId,
      status: 'usable',
      visibility: 'list-shared',
    })
    if (shared) return shared
  }

  return recipes.findOne(publicRecipeFilter(recipeId))
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = createRecipeSelectionSchema.safeParse(body)
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string[]>>(
      (result, issue) => {
        const field = issue.path[0]?.toString() ?? 'selection'
        result[field] = [...(result[field] ?? []), issue.message]
        return result
      },
      {},
    )
    return validationFailed(fields)
  }

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, session.user.id))
  if (!list) return listNotFound()
  if (list.status !== 'active') return archivedList()

  const recipe = await findAccessibleRecipe(
    listId,
    parsed.data.recipeId,
    session.user.id,
    db,
  )
  if (!recipe || !recipe.typicalPeopleFed) return recipeNotFound()

  const versionId = recipe.versionId ?? recipe._id
  const versionNumber = recipe.versionNumber ?? 1
  const version = await db
    .collection<RecipeVersionDocument>('recipe_versions')
    .findOne({
      _id: versionId,
      recipeId: recipe.recipeId ?? recipe._id,
      versionNumber,
      status: 'usable',
    })
  if (!version) return versionUnavailable()

  const selection = createRecipeSelectionDocument(
    recipe,
    parsed.data.desiredPeople,
  )
  const run = await db
    .collection<ShoppingRunDocument>('shopping_runs')
    .findOneAndUpdate(
      { _id: list.activeRunId, listId, state: 'active' },
      {
        $push: { recipeSelections: selection },
        $inc: { revision: 1 },
        $set: { updatedAt: selection.updatedAt },
      },
      { returnDocument: 'after' },
    )
  if (!run) return archivedList()

  return Response.json(
    {
      selection,
      recipe: {
        id: recipe.recipeId ?? recipe._id,
        title: recipe.title,
        typicalPeopleFed: recipe.typicalPeopleFed,
        versionId,
        versionNumber,
      },
      calculatedIngredients: calculateScaledIngredients(
        version.ingredients ?? [],
        selection.scaleFactor,
      ),
      revision: run.revision,
    },
    { status: 201 },
  )
}
