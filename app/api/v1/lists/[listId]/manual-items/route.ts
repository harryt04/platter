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
  createManualGroceryAdditionDocument,
  createManualGroceryRequestSchema,
  manualMutationReceiptFor,
} from '@/lib/recipes/manual-groceries'

type RouteContext = { params: Promise<{ listId: string }> }

function problem(code: string, title: string, detail: string, status: number) {
  return problemResponse({
    type: `https://platter.dev/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    detail,
    code,
  })
}

function validationFailed(fields: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the grocery item',
    status: 422,
    detail: 'Enter a grocery item and retry metadata.',
    code: 'VALIDATION_FAILED',
    fields,
  })
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to add a manual grocery item.',
      401,
    )

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success)
    return problem(
      'LIST_NOT_FOUND',
      'List not found',
      'That list is not available to you.',
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

  const parsed = createManualGroceryRequestSchema.safeParse(body)
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

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, session.user.id))
  if (!list)
    return problem(
      'LIST_NOT_FOUND',
      'List not found',
      'That list is not available to you.',
      404,
    )
  if (list.status !== 'active')
    return problem(
      'LIST_NOT_ACTIVE',
      'List is archived',
      'Unarchive this list before changing its groceries.',
      409,
    )

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const currentRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!currentRun)
    return problem(
      'LIST_NOT_ACTIVE',
      'Shopping run unavailable',
      'This list does not have an active shopping run.',
      409,
    )

  try {
    const receipt = manualMutationReceiptFor(
      currentRun.manualMutationReceipts,
      parsed.data,
      'create',
      'manual:create',
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
    parsed.data.baseRevision !== currentRun.revision
  )
    return problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      'Reload the shopping run before changing its groceries.',
      409,
    )

  const addition = createManualGroceryAdditionDocument(parsed.data.line)
  const response = {
    addition,
    detail: 'Manual grocery item added.',
    code: 'MANUAL_GROCERY_ADDED',
    revision: currentRun.revision + 1,
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
        manualAdditions: addition,
        manualMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target: 'manual:create',
          kind: 'create',
          status: 201,
          response,
        },
      },
      $inc: { revision: 1 },
      $set: { updatedAt: addition.updatedAt },
    },
    { returnDocument: 'after' },
  )
  if (updatedRun) return Response.json(response, { status: 201 })

  const retryRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  try {
    const receipt = manualMutationReceiptFor(
      retryRun?.manualMutationReceipts,
      parsed.data,
      'create',
      'manual:create',
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
  return problem(
    'RUN_REVISION_CONFLICT',
    'Shopping run changed',
    'Reload the shopping run before changing its groceries.',
    409,
  )
}
