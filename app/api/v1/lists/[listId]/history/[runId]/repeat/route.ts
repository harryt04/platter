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
  selectionMutationReceiptFor,
  type RecipeSelectionDocument,
  type SelectionMutationReceipt,
} from '@/lib/recipes/selections'
import type { ShoppingRunHistoryDocument } from '@/lib/shopping-run-history'
import { publishRunMutationEvent } from '@/lib/realtime/events'
import { isoDateTime } from '@/lib/contracts/ids'
import { z } from 'zod'

type RouteContext = { params: Promise<{ listId: string; runId: string }> }

const repeatRequestSchema = z.object({
  runId: z.string().trim().min(1).max(200).optional(),
  operationId: z.string().trim().min(1).max(200),
  clientId: z.string().trim().min(1).max(200),
  baseRevision: z.number().int().nonnegative().optional(),
})

function problem(code: string, title: string, detail: string, status: number) {
  return problemResponse({
    type: `https://platter.dev/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    detail,
    code,
  })
}

function listNotFound() {
  return problem(
    'LIST_NOT_FOUND',
    'List not found',
    'That list is not available to you.',
    404,
  )
}

function historyNotFound() {
  return problem(
    'HISTORY_NOT_FOUND',
    'Completed run not found',
    'That completed shopping run is not available to you.',
    404,
  )
}

function validationFailed() {
  return problem(
    'VALIDATION_FAILED',
    'Check the repeat request',
    'Include valid retry metadata for this shopping run.',
    422,
  )
}

function runUnavailable() {
  return problem(
    'RUN_NOT_ACTIVE',
    'Shopping run unavailable',
    'This list does not have an active shopping run to add recipes to.',
    409,
  )
}

function revisionConflict() {
  return problem(
    'RUN_REVISION_CONFLICT',
    'Shopping run changed',
    'Reload the shopping run before repeating these recipes.',
    409,
  )
}

function operationIdConflict() {
  return problem(
    'OPERATION_ID_REUSED',
    'Repeat could not be retried',
    'Use a new operation id for this history action.',
    409,
  )
}

function recipeVersionUnavailable() {
  return problem(
    'RECIPE_VERSION_UNAVAILABLE',
    'Recipe version unavailable',
    'One or more historical recipes are no longer available to this list.',
    409,
  )
}

async function findAccessibleCurrentRecipe(
  db: Awaited<ReturnType<typeof getConnectedDatabase>>,
  listId: string,
  recipeId: string,
  userId: string,
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
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to repeat a completed shopping run.',
      401,
    )

  const { listId, runId: historyId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationFailed()
  }
  const parsed = repeatRequestSchema.safeParse(body)
  if (!parsed.success) return validationFailed()

  const db = await getConnectedDatabase()
  const lists = db.collection<ListDocument>('lists')
  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const histories = db.collection<ShoppingRunHistoryDocument>(
    'shopping_run_history',
  )
  const list = await lists.findOne(listRoleFilter(listId, session.user.id))
  if (!list) return listNotFound()
  if (list.status !== 'active') return runUnavailable()

  const currentRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!currentRun) return runUnavailable()
  if (parsed.data.runId && parsed.data.runId !== currentRun._id) {
    return revisionConflict()
  }
  const mutationMetadata = {
    ...parsed.data,
    runId: parsed.data.runId ?? currentRun._id,
  }

  let receipt: SelectionMutationReceipt | null
  try {
    receipt = selectionMutationReceiptFor(
      currentRun.selectionMutationReceipts,
      mutationMetadata,
      'repeat-history',
      `history:${historyId}`,
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

  const history = await histories.findOne({ _id: historyId, listId })
  if (!history) return historyNotFound()

  const historicalSelections: RecipeSelectionDocument[] = []
  for (const reference of history.recipeSelections) {
    const currentRecipe = await findAccessibleCurrentRecipe(
      db,
      listId,
      reference.recipeId,
      session.user.id,
    )
    if (!currentRecipe) return recipeVersionUnavailable()

    const version = await db
      .collection<RecipeVersionDocument>('recipe_versions')
      .findOne({
        _id: reference.versionId,
        recipeId: reference.recipeId,
        versionNumber: reference.versionNumber,
        status: 'usable',
      })
    if (
      !version ||
      !version.typicalPeopleFed ||
      version.ingredients.length === 0
    ) {
      return recipeVersionUnavailable()
    }

    historicalSelections.push(
      createRecipeSelectionDocument(version, reference.desiredPeople),
    )
  }

  const response = {
    historyId,
    addedCount: historicalSelections.length,
    selections: historicalSelections,
    revision: currentRun.revision + 1,
  }
  const selectionReceipt: SelectionMutationReceipt = {
    operationId: parsed.data.operationId,
    clientId: parsed.data.clientId,
    target: `history:${historyId}`,
    kind: 'repeat-history',
    status: 200,
    response,
  }
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      revision: currentRun.revision,
    },
    {
      $push: {
        recipeSelections: { $each: historicalSelections },
        selectionMutationReceipts: selectionReceipt,
      },
      $inc: { revision: 1 },
      $set: { updatedAt: isoDateTime(new Date()) },
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
        mutationMetadata,
        'repeat-history',
        `history:${historyId}`,
      )
      if (retryReceipt) return Response.json(retryReceipt.response)
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

  return Response.json(response)
}
