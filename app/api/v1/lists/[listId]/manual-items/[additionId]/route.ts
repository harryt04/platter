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
  manualMutationReceiptFor,
  updateManualGroceryRequestSchema,
  updateManualGroceryAdditionDocument,
} from '@/lib/recipes/manual-groceries'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'

type RouteContext = {
  params: Promise<{ listId: string; additionId: string }>
}

function problem(code: string, title: string, detail: string, status: number) {
  return problemResponse({
    type: `https://platter.dev/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    detail,
    code,
  })
}

function validationFailed(fields?: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the grocery item',
    status: 422,
    detail: 'Enter a grocery item and retry metadata.',
    code: 'VALIDATION_FAILED',
    ...(fields ? { fields } : {}),
  })
}

async function loadRun(listId: string, userId: string) {
  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, userId))
  if (!list) return { db, list: null, run: null }
  const run = await db
    .collection<ShoppingRunDocument>('shopping_runs')
    .findOne({ _id: list.activeRunId, listId, state: 'active' })
  return { db, list, run }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to edit a manual grocery item.',
      401,
    )

  const { listId, additionId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !listIdSchema.safeParse(additionId).success
  )
    return problem(
      'MANUAL_GROCERY_NOT_FOUND',
      'Grocery item not found',
      'That manual grocery item is not available to you.',
      404,
    )

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problem(
      'INVALID_JSON',
      'Invalid request',
      'Send a grocery item line and mutation metadata.',
      400,
    )
  }
  const parsed = updateManualGroceryRequestSchema.safeParse(body)
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string[]>>(
      (result, issue) => {
        const field = issue.path[0]?.toString() ?? 'grocery'
        result[field] = [...(result[field] ?? []), issue.message]
        return result
      },
      {},
    )
    return validationFailed(fields)
  }

  const { db, list, run } = await loadRun(listId, session.user.id)
  if (!list)
    return problem(
      'LIST_NOT_FOUND',
      'List not found',
      'That list is not available to you.',
      404,
    )
  if (list.status !== 'active' || !run)
    return problem(
      'LIST_NOT_ACTIVE',
      'List is archived',
      'Unarchive this list before changing its groceries.',
      409,
    )

  const target = `manual:${additionId}`
  try {
    const receipt = manualMutationReceiptFor(
      run.manualMutationReceipts,
      parsed.data,
      'update',
      target,
    )
    if (receipt)
      return Response.json(receipt.response, { status: receipt.status })
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this grocery change.',
      409,
    )
  }
  if (
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== run.revision
  )
    return problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      'Reload the shopping run before changing its groceries.',
      409,
    )

  const addition = run.manualAdditions.find(
    (candidate) => candidate.id === additionId,
  )
  if (!addition)
    return problem(
      'MANUAL_GROCERY_NOT_FOUND',
      'Grocery item not found',
      'That manual grocery item is not in this shopping run.',
      404,
    )
  const updatedAddition = updateManualGroceryAdditionDocument(
    addition,
    parsed.data.line,
  )
  const response = {
    addition: updatedAddition,
    detail: 'Manual grocery item updated.',
    code: 'MANUAL_GROCERY_UPDATED',
    revision: run.revision + 1,
  }
  const updatedRun = await db
    .collection<ShoppingRunDocument>('shopping_runs')
    .findOneAndUpdate(
      {
        _id: run._id,
        listId,
        state: 'active',
        revision: run.revision,
        'manualAdditions.id': additionId,
      },
      {
        $set: {
          'manualAdditions.$': updatedAddition,
          updatedAt: updatedAddition.updatedAt,
        },
        $push: {
          manualMutationReceipts: {
            operationId: parsed.data.operationId,
            clientId: parsed.data.clientId,
            target,
            kind: 'update',
            status: 200,
            response,
          },
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' },
    )
  if (!updatedRun)
    return problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      'Reload the shopping run before changing its groceries.',
      409,
    )
  return Response.json(response)
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to remove a manual grocery item.',
      401,
    )

  const { listId, additionId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !listIdSchema.safeParse(additionId).success
  )
    return problem(
      'MANUAL_GROCERY_NOT_FOUND',
      'Grocery item not found',
      'That manual grocery item is not available to you.',
      404,
    )

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return validationFailed()
  }
  const parsed = selectionMutationMetadataSchema.safeParse(body)
  if (!parsed.success) return validationFailed()

  const { db, list, run } = await loadRun(listId, session.user.id)
  if (!list)
    return problem(
      'LIST_NOT_FOUND',
      'List not found',
      'That list is not available to you.',
      404,
    )
  if (list.status !== 'active' || !run)
    return problem(
      'LIST_NOT_ACTIVE',
      'List is archived',
      'Unarchive this list before changing its groceries.',
      409,
    )

  const target = `manual:${additionId}`
  try {
    const receipt = manualMutationReceiptFor(
      run.manualMutationReceipts,
      parsed.data,
      'remove',
      target,
    )
    if (receipt)
      return Response.json(receipt.response, { status: receipt.status })
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this grocery change.',
      409,
    )
  }
  if (
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== run.revision
  )
    return problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      'Reload the shopping run before changing its groceries.',
      409,
    )

  if (!run.manualAdditions.some((candidate) => candidate.id === additionId))
    return problem(
      'MANUAL_GROCERY_NOT_FOUND',
      'Grocery item not found',
      'That manual grocery item is not in this shopping run.',
      404,
    )
  const response = {
    detail: 'Manual grocery item removed.',
    code: 'MANUAL_GROCERY_REMOVED',
    additionId,
    revision: run.revision + 1,
  }
  const updatedRun = await db
    .collection<ShoppingRunDocument>('shopping_runs')
    .findOneAndUpdate(
      {
        _id: run._id,
        listId,
        state: 'active',
        revision: run.revision,
        'manualAdditions.id': additionId,
      },
      {
        $pull: { manualAdditions: { id: additionId } },
        $push: {
          manualMutationReceipts: {
            operationId: parsed.data.operationId,
            clientId: parsed.data.clientId,
            target,
            kind: 'remove',
            status: 200,
            response,
          },
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' },
    )
  if (!updatedRun)
    return problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      'Reload the shopping run before changing its groceries.',
      409,
    )
  return Response.json(response)
}
