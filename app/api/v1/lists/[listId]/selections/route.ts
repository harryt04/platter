import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import { publishRunMutationEvent } from '@/lib/realtime/events'
import { completedRunProblem } from '@/lib/contracts/run-mutation'
import {
  ownedRecipeFilter,
  publicRecipeFilter,
  type RecipeDraftDocument,
  type RecipeShareDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import {
  createRecipeSelectionDocument,
  createRecipeSelectionRequestSchema,
  selectionMutationReceiptFor,
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

function revisionConflict() {
  return problemResponse({
    type: 'https://platter.dev/problems/run-revision-conflict',
    title: 'Shopping run changed',
    status: 409,
    detail: 'Reload the shopping run before adding this recipe.',
    code: 'RUN_REVISION_CONFLICT',
  })
}

function operationIdConflict() {
  return problemResponse({
    type: 'https://platter.dev/problems/operation-id-reused',
    title: 'Mutation could not be retried',
    status: 409,
    detail: 'Use a new operation id for this selection change.',
    code: 'OPERATION_ID_REUSED',
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

  const parsed = createRecipeSelectionRequestSchema.safeParse(body)
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
  if (list.activeRunId !== parsed.data.runId) return completedRunProblem()

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const currentRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!currentRun) return archivedList()

  let receipt
  try {
    receipt = selectionMutationReceiptFor(
      currentRun.selectionMutationReceipts,
      parsed.data,
      'create',
      `recipe:${parsed.data.recipeId}`,
    )
  } catch {
    return operationIdConflict()
  }
  if (receipt)
    return Response.json(receipt.response, { status: receipt.status })
  if (
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== currentRun.revision
  ) {
    return revisionConflict()
  }

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
  const calculatedIngredients = calculateScaledIngredients(
    version.ingredients ?? [],
    selection.scaleFactor,
  )
  const response = {
    selection,
    recipe: {
      id: recipe.recipeId ?? recipe._id,
      title: recipe.title,
      typicalPeopleFed: recipe.typicalPeopleFed,
      versionId,
      versionNumber,
    },
    calculatedIngredients,
    revision: currentRun.revision + 1,
  }
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id ?? list.activeRunId,
      listId,
      state: 'active',
      revision: currentRun.revision,
    },
    {
      $push: {
        recipeSelections: selection,
        selectionMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target: `recipe:${parsed.data.recipeId}`,
          kind: 'create',
          status: 201,
          response,
        },
      },
      $inc: { revision: 1 },
      $set: { updatedAt: selection.updatedAt },
    },
    { returnDocument: 'after' },
  )
  if (!updatedRun) {
    const retryRun = await runs.findOne({
      _id: list.activeRunId,
      listId,
      state: 'active',
    })
    try {
      const retryReceipt = selectionMutationReceiptFor(
        retryRun?.selectionMutationReceipts,
        parsed.data,
        'create',
        `recipe:${parsed.data.recipeId}`,
      )
      if (retryReceipt) {
        return Response.json(retryReceipt.response, {
          status: retryReceipt.status,
        })
      }
    } catch {
      return operationIdConflict()
    }
    return revisionConflict()
  }

  await publishRunMutationEvent(db, {
    type: 'recipe.selection.added',
    listId,
    runId: currentRun._id,
    revision: response.revision,
    operationId: parsed.data.operationId,
    actorId: session.user.id,
  }).catch(() => undefined)
  return Response.json(response, { status: 201 })
}
