import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import { isoDateTime } from '@/lib/contracts/ids'
import { publishRunMutationEvent } from '@/lib/realtime/events'
import { completedRunProblem } from '@/lib/contracts/run-mutation'
import { type RecipeVersionDocument } from '@/lib/recipes/drafts'
import {
  selectionMutationReceiptFor,
  selectionMutationMetadataSchema,
  updateRecipeSelectionDocument,
  updateRecipeSelectionRequestSchema,
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
    detail: 'Sign in to change a recipe selection.',
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

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send the number of people this recipe should feed.',
    code: 'INVALID_JSON',
  })
}

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the people count',
    status: 422,
    detail: 'Enter a positive whole number of people.',
    code: 'VALIDATION_FAILED',
    fields: { desiredPeople: ['People must be a positive whole number.'] },
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
    detail:
      'The selected recipe version is no longer available to recalculate.',
    code: 'RECIPE_VERSION_UNAVAILABLE',
  })
}

function revisionConflict() {
  return problemResponse({
    type: 'https://platter.dev/problems/run-revision-conflict',
    title: 'Shopping run changed',
    status: 409,
    detail: 'Reload the shopping run before changing this selection.',
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

function invalidMutationMetadata() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the mutation metadata',
    status: 422,
    detail: 'Retry with an operation id and client id.',
    code: 'VALIDATION_FAILED',
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, selectionId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !selectionIdSchema.safeParse(selectionId).success
  ) {
    return selectionNotFound()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }
  const parsed = updateRecipeSelectionRequestSchema.safeParse(body)
  if (!parsed.success) return validationFailed()

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
      'update-people',
      `selection:${selectionId}`,
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

  if (selection.desiredPeople === parsed.data.desiredPeople) {
    const response = {
      selection,
      calculatedIngredients: calculateScaledIngredients(
        version.ingredients ?? [],
        selection.scaleFactor,
      ),
      revision: currentRun.revision,
    }
    const recordedRun = await runs.findOneAndUpdate(
      {
        _id: currentRun._id,
        listId,
        state: 'active',
        revision: currentRun.revision,
      },
      {
        $push: {
          selectionMutationReceipts: {
            operationId: parsed.data.operationId,
            clientId: parsed.data.clientId,
            target: `selection:${selectionId}`,
            kind: 'update-people',
            status: 200,
            response,
          },
        },
      },
      { returnDocument: 'after' },
    )
    if (!recordedRun) {
      const retryRun = await runs.findOne({
        _id: currentRun._id,
        listId,
        state: 'active',
      })
      try {
        const retryReceipt = selectionMutationReceiptFor(
          retryRun?.selectionMutationReceipts,
          parsed.data,
          'update-people',
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
      return revisionConflict()
    }
    return Response.json(response)
  }

  const updatedSelection = updateRecipeSelectionDocument(
    selection,
    parsed.data.desiredPeople,
    version.typicalPeopleFed,
  )
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      revision: currentRun.revision,
      'recipeSelections._id': selectionId,
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
          kind: 'update-people',
          status: 200,
          response: {
            selection: updatedSelection,
            calculatedIngredients: calculateScaledIngredients(
              version.ingredients ?? [],
              updatedSelection.scaleFactor,
            ),
            revision: currentRun.revision + 1,
          },
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
        'update-people',
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
    return revisionConflict()
  }

  const response = {
    selection: updatedSelection,
    calculatedIngredients: calculateScaledIngredients(
      version.ingredients ?? [],
      updatedSelection.scaleFactor,
    ),
    revision: currentRun.revision + 1,
  }
  await publishRunMutationEvent(db, {
    type: 'recipe.selection.people-changed',
    listId,
    runId: currentRun._id,
    revision: response.revision,
    operationId: parsed.data.operationId,
    actorId: session.user.id,
  }).catch(() => undefined)
  return Response.json(response)
}

export async function DELETE(request: Request, context: RouteContext) {
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
  if (!parsed.success) return invalidMutationMetadata()

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, session.user.id))
  if (!list) return listNotFound()
  if (list.status !== 'active') return archivedList()

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
      'remove',
      `selection:${selectionId}`,
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

  const selection = currentRun.recipeSelections.find(
    (candidate) => candidate._id === selectionId,
  )
  if (!selection) return selectionNotFound()

  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      revision: currentRun.revision,
      'recipeSelections._id': selectionId,
    },
    {
      $pull: { recipeSelections: { _id: selectionId } },
      $push: {
        selectionMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target: `selection:${selectionId}`,
          kind: 'remove',
          status: 200,
          response: {
            detail: 'The recipe selection was removed from this shopping run.',
            code: 'SELECTION_REMOVED',
            selectionId,
            revision: currentRun.revision + 1,
          },
        },
      },
      $inc: { revision: 1 },
      $set: { updatedAt: isoDateTime(new Date()) },
    },
    { returnDocument: 'after' },
  )
  if (!updatedRun) return revisionConflict()

  const response = {
    detail: 'The recipe selection was removed from this shopping run.',
    code: 'SELECTION_REMOVED',
    selectionId,
    revision: currentRun.revision + 1,
  }
  await publishRunMutationEvent(db, {
    type: 'recipe.selection.removed',
    listId,
    runId: currentRun._id,
    revision: response.revision,
    operationId: parsed.data.operationId,
    actorId: session.user.id,
  }).catch(() => undefined)
  return Response.json(response)
}
