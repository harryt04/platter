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
import { type RecipeVersionDocument } from '@/lib/recipes/drafts'
import {
  duplicateRecipeSelectionDocument,
  recipeSelectionMutationResponseSchema,
  selectionMutationMetadataSchema,
  selectionMutationReceiptFor,
} from '@/lib/recipes/selections'
import { calculateScaledIngredients } from '@/lib/recipes/scaling'

type RouteContext = {
  params: Promise<{ listId: string; selectionId: string }>
}

const selectionIdSchema = listIdSchema

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to duplicate a recipe selection.',
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

function selectionNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/selection-not-found',
    title: 'Recipe selection not found',
    status: 404,
    detail: 'That recipe is not selected in this shopping run.',
    code: 'SELECTION_NOT_FOUND',
  })
}

function archivedList() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-active',
    title: 'List is archived',
    status: 409,
    detail: 'Unarchive this list before changing its shopping run.',
    code: 'LIST_NOT_ACTIVE',
  })
}

function versionUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-version-unavailable',
    title: 'Recipe version unavailable',
    status: 409,
    detail: 'That recipe version is no longer available to duplicate.',
    code: 'RECIPE_VERSION_UNAVAILABLE',
  })
}

function revisionConflict() {
  return problemResponse({
    type: 'https://platter.dev/problems/run-revision-conflict',
    title: 'Shopping run changed',
    status: 409,
    detail: 'Reload the shopping run before duplicating this selection.',
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

function selectionMutationUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/selection-state-unavailable',
    title: 'Recipe selection temporarily unavailable',
    status: 503,
    detail:
      'The recipe selection is temporarily unavailable. Try again shortly.',
    code: 'SELECTION_STATE_UNAVAILABLE',
  })
}

function responseJson(value: unknown, status: 200 | 201 = 200) {
  const parsed = recipeSelectionMutationResponseSchema.safeParse(value)
  return parsed.success
    ? Response.json(parsed.data, { status })
    : selectionMutationUnavailable()
}

async function duplicateSelection(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, selectionId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !selectionIdSchema.safeParse(selectionId).success
  ) {
    return selectionNotFound()
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // An empty body is handled by the metadata validation below.
  }
  const parsed = selectionMutationMetadataSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the mutation metadata',
      status: 422,
      detail: 'Retry with an operation id and client id.',
      code: 'VALIDATION_FAILED',
    })
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
      'duplicate',
      `selection:${selectionId}`,
    )
  } catch {
    return operationIdConflict()
  }
  if (receipt) return responseJson(receipt.response, receipt.status)
  if (
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== currentRun.revision
  ) {
    return revisionConflict()
  }

  const selection = currentRun.recipeSelections.find(
    (candidate) => candidate._id === selectionId,
  )
  if (!selection) return selectionNotFound()

  const version = await db
    .collection<RecipeVersionDocument>('recipe_versions')
    .findOne({
      _id: selection.versionId,
      recipeId: selection.recipeId,
      versionNumber: selection.versionNumber,
      status: 'usable',
    })
  if (!version || !version.typicalPeopleFed) return versionUnavailable()

  const duplicate = duplicateRecipeSelectionDocument(selection)
  const response = {
    selection: duplicate,
    recipe: {
      id: selection.recipeId,
      title: version.title,
      typicalPeopleFed: version.typicalPeopleFed,
      versionId: selection.versionId,
      versionNumber: selection.versionNumber,
    },
    calculatedIngredients: calculateScaledIngredients(
      version.ingredients ?? [],
      duplicate.scaleFactor,
    ),
    revision: currentRun.revision + 1,
  }
  const validatedResponse =
    recipeSelectionMutationResponseSchema.safeParse(response)
  if (!validatedResponse.success) return selectionMutationUnavailable()
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      revision: currentRun.revision,
    },
    {
      $push: {
        recipeSelections: duplicate,
        selectionMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target: `selection:${selectionId}`,
          kind: 'duplicate',
          status: 201,
          response: validatedResponse.data,
        },
      },
      $inc: { revision: 1 },
      $set: { updatedAt: duplicate.updatedAt },
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
        'duplicate',
        `selection:${selectionId}`,
      )
      if (retryReceipt) {
        return responseJson(retryReceipt.response, retryReceipt.status)
      }
    } catch {
      return operationIdConflict()
    }
    return revisionConflict()
  }

  await publishRunMutationEvent(db, {
    type: 'recipe.selection.duplicated',
    listId,
    runId: currentRun._id,
    revision: response.revision,
    operationId: parsed.data.operationId,
    actorId: session.user.id,
  }).catch(() => undefined)
  return responseJson(validatedResponse.data, 201)
}

export async function POST(request: Request, context: RouteContext) {
  try {
    return await duplicateSelection(request, context)
  } catch {
    return selectionMutationUnavailable()
  }
}
