import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import { problemResponse } from '@/lib/contracts/problem'
import {
  listIdSchema,
  listRoleFilter,
  createActiveShoppingRunDocument,
  type CompletionMutationReceipt,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import {
  createShoppingRunHistoryDocument,
  type ShoppingRunHistoryDocument,
} from '@/lib/shopping-run-history'
import { z } from 'zod'
import { publishRunCompletionEvent } from '@/lib/realtime/events'

type RouteContext = { params: Promise<{ listId: string }> }

const completionRequestSchema = z.object({
  operationId: z.string().trim().min(1).max(200),
  clientId: z.string().trim().min(1).max(200),
  baseRevision: z.number().int().nonnegative().optional(),
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a local calendar date.')
    .refine((value) => {
      const [year, month, day] = value.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      )
    }, 'Use a real local calendar date.'),
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

function validationFailed() {
  return problem(
    'VALIDATION_FAILED',
    'Check the completion details',
    'Include a valid operation id, client id, and local calendar date.',
    422,
  )
}

function runUnavailable() {
  return problem(
    'RUN_NOT_ACTIVE',
    'Shopping run unavailable',
    'This list does not have an active shopping run to complete.',
    409,
  )
}

function revisionConflict() {
  return problem(
    'RUN_REVISION_CONFLICT',
    'Shopping run changed',
    'Reload the shopping run before completing it.',
    409,
  )
}

function operationIdConflict() {
  return problem(
    'OPERATION_ID_REUSED',
    'Completion could not be retried',
    'Use a new operation id for this completion.',
    409,
  )
}

function findCompletionReceipt(
  receipts: CompletionMutationReceipt[] | undefined,
  operationId: string,
  clientId: string,
) {
  const receipt = receipts?.find(
    (candidate) => candidate.operationId === operationId,
  )
  if (!receipt) return null
  if (receipt.clientId !== clientId) throw new Error('operation-id-reused')
  return receipt
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to complete a shopping run.',
      401,
    )

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationFailed()
  }
  const parsed = completionRequestSchema.safeParse(body)
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

  try {
    const receipt = findCompletionReceipt(
      list.completionMutationReceipts,
      parsed.data.operationId,
      parsed.data.clientId,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return operationIdConflict()
  }

  const run = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!run) return runUnavailable()
  if (
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== run.revision
  )
    return revisionConflict()

  const now = new Date()
  const history = createShoppingRunHistoryDocument(
    run,
    session.user.id,
    parsed.data.localDate,
    now,
  )
  const nextRun = createActiveShoppingRunDocument(listId, now)
  const response = {
    completed: true,
    historyId: history._id,
    completedAt: history.completedAt,
    localDate: history.localDate,
    completedByUserId: history.completedByUserId,
    activeRunId: nextRun._id,
  }
  const receipt: CompletionMutationReceipt = {
    operationId: parsed.data.operationId,
    clientId: parsed.data.clientId,
    status: 200,
    response,
  }

  try {
    await getMongoClient().withSession(async (sessionWithTransaction) => {
      await sessionWithTransaction.withTransaction(
        async (transactionSession) => {
          const deleted = await runs.deleteOne(
            { _id: run._id, listId, state: 'active' },
            { session: transactionSession },
          )
          if (deleted.deletedCount !== 1) throw new Error('run-changed')

          await histories.insertOne(history, { session: transactionSession })
          await runs.insertOne(nextRun, { session: transactionSession })

          const updatedList = await lists.findOneAndUpdate(
            {
              ...listRoleFilter(listId, session.user.id),
              status: 'active',
              activeRunId: run._id,
            },
            {
              $set: {
                activeRunId: nextRun._id,
                updatedAt: history.completedAt,
              },
              $push: {
                completionMutationReceipts: { $each: [receipt], $slice: -20 },
              },
            },
            { session: transactionSession, returnDocument: 'after' },
          )
          if (!updatedList) throw new Error('list-changed')
        },
      )
    })
  } catch {
    const latestList = await lists.findOne(
      listRoleFilter(listId, session.user.id),
    )
    try {
      const retryReceipt = findCompletionReceipt(
        latestList?.completionMutationReceipts,
        parsed.data.operationId,
        parsed.data.clientId,
      )
      if (retryReceipt) return Response.json(retryReceipt.response)
    } catch {
      return operationIdConflict()
    }
    return revisionConflict()
  }

  try {
    await publishRunCompletionEvent(db, {
      listId,
      runId: run._id,
      nextRunId: nextRun._id,
      operationId: parsed.data.operationId,
      completedByUserId: session.user.id,
      now,
    })
  } catch {
    // The transaction is authoritative; a realtime outage must not undo it.
  }

  return Response.json(response)
}
