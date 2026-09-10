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
import {
  ownedRecipeFilter,
  publicRecipeFilter,
  type RecipeDraftDocument,
  type RecipeShareDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import {
  acceptNewerRecipeVersion,
  selectionMutationMetadataSchema,
  selectionMutationReceiptFor,
} from '@/lib/recipes/selections'
import { calculateScaledIngredients } from '@/lib/recipes/scaling'

type RouteContext = {
  params: Promise<{ listId: string; selectionId: string }>
}

const selectionIdSchema = listIdSchema

function problem(
  code: string,
  title: string,
  status: 401 | 404 | 409 | 422,
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

function operationIdConflict() {
  return problem(
    'OPERATION_ID_REUSED',
    'Mutation could not be retried',
    409,
    'Use a new operation id for this selection change.',
  )
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

export async function POST(request: Request, context: RouteContext) {
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

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // An empty body is handled by metadata validation below.
  }
  const parsed = selectionMutationMetadataSchema.safeParse(body)
  if (!parsed.success) {
    return problem(
      'VALIDATION_FAILED',
      'Check the mutation metadata',
      422,
      'Retry with an operation id and client id.',
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
  let receipt
  try {
    receipt = selectionMutationReceiptFor(
      currentRun?.selectionMutationReceipts,
      parsed.data,
      'repin',
      `selection:${selectionId}`,
    )
  } catch {
    return operationIdConflict()
  }
  if (receipt)
    return Response.json(receipt.response, { status: receipt.status })
  if (
    currentRun &&
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== currentRun.revision
  ) {
    return problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      409,
      'Reload the shopping run before accepting this recipe update.',
    )
  }

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
  const response = {
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
    revision: currentRun.revision + 1,
  }
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      'recipeSelections._id': selectionId,
      'recipeSelections.versionId': selection.versionId,
      'recipeSelections.versionNumber': selection.versionNumber,
      revision: currentRun.revision,
    },
    {
      $set: {
        'recipeSelections.$': updatedSelection,
        updatedAt: updatedSelection.updatedAt,
      },
      $push: {
        selectionMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target: `selection:${selectionId}`,
          kind: 'repin',
          status: 200,
          response,
        },
      },
      $inc: { revision: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!updatedRun) {
    const retryRun = await runs.findOne({
      _id: currentRun._id,
      listId,
      state: 'active',
    })
    try {
      const retryReceipt = selectionMutationReceiptFor(
        retryRun?.selectionMutationReceipts,
        parsed.data,
        'repin',
        `selection:${selectionId}`,
      )
      if (retryReceipt) {
        return Response.json(retryReceipt.response, {
          status: retryReceipt.status,
        })
      }
    } catch {
      return operationIdConflict()
    }
    return problem(
      'SELECTION_CHANGED',
      'Selection changed elsewhere',
      409,
      'Reload the list before accepting this recipe update.',
    )
  }

  await publishRunMutationEvent(db, {
    type: 'recipe.selection.repinned',
    listId,
    runId: currentRun._id,
    revision: response.revision,
    operationId: parsed.data.operationId,
    actorId: session.user.id,
  }).catch(() => undefined)
  return Response.json(response)
}
