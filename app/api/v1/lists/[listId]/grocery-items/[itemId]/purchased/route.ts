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
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'
import { generateGroceryItems } from '@/lib/recipes/groceries'
import { completedRunProblem } from '@/lib/contracts/run-mutation'
import {
  createGroceryPurchasedDocument,
  groceryPurchasedMutationReceiptFor,
  groceryPurchasedMutationResponseSchema,
  groceryPurchasedRequestSchema,
  type GroceryPurchasedMutationResponse,
  type GroceryPurchasedMutationReceipt,
} from '@/lib/recipes/grocery-purchased'

type RouteContext = {
  params: Promise<{ listId: string; itemId: string }>
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

function validationFailed() {
  return problem(
    'VALIDATION_FAILED',
    'Check the purchased action',
    'Include valid retry metadata and try again.',
    422,
  )
}

function purchasedStateUnavailable() {
  return problem(
    'PURCHASED_STATE_UNAVAILABLE',
    'Purchased state temporarily unavailable',
    'The purchased state is temporarily unavailable. Try again shortly.',
    503,
  )
}

function responseJson(value: unknown) {
  const parsed = groceryPurchasedMutationResponseSchema.safeParse(value)
  return parsed.success
    ? Response.json(parsed.data)
    : purchasedStateUnavailable()
}

async function currentGroceryItems(
  db: Awaited<ReturnType<typeof getConnectedDatabase>>,
  run: ShoppingRunDocument,
) {
  const resolvedSelections = await resolveRunRecipeVersions(
    db,
    run.recipeSelections,
  )
  return generateGroceryItems({
    selections: resolvedSelections.flatMap(({ version }, index) => {
      const selection = run.recipeSelections[index]
      return selection && version ? [{ selection, version }] : []
    }),
    manualAdditions: run.manualAdditions ?? [],
    overrides: run.groceryAmountOverrides ?? [],
    categoryOverrides: run.groceryCategoryOverrides ?? [],
    splitContributionIds:
      run.groceryMergeSplits?.map(({ contributionId }) => contributionId) ?? [],
  })
}

async function loadContext(
  request: Request,
  context: RouteContext,
  action: 'mark' | 'undo',
) {
  const session = await getSession()
  if (!session)
    return {
      response: problem(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        action === 'mark'
          ? 'Sign in to mark groceries purchased.'
          : 'Sign in to undo a purchased grocery.',
        401,
      ),
    }

  const { listId, itemId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !listIdSchema.safeParse(itemId).success
  )
    return {
      response: problem(
        'GROCERY_ITEM_NOT_FOUND',
        'Grocery item not found',
        'That grocery item is not available to you.',
        404,
      ),
    }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: validationFailed() }
  }
  const parsed = groceryPurchasedRequestSchema.safeParse(body)
  if (!parsed.success) return { response: validationFailed() }

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, session.user.id))
  if (!list)
    return {
      response: problem(
        'LIST_NOT_FOUND',
        'List not found',
        'That list is not available to you.',
        404,
      ),
    }
  if (list.status !== 'active')
    return {
      response: problem(
        'LIST_NOT_ACTIVE',
        'List is archived',
        'Unarchive this list before changing its groceries.',
        409,
      ),
    }

  if (list.activeRunId !== parsed.data.runId)
    return { response: completedRunProblem() }

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const run = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!run)
    return {
      response: problem(
        'LIST_NOT_ACTIVE',
        'Shopping run unavailable',
        'This list does not have an active shopping run.',
        409,
      ),
    }

  const target = `grocery-item:${itemId}:purchased`
  const kind: GroceryPurchasedMutationReceipt['kind'] =
    action === 'mark' ? 'set' : 'remove'
  try {
    const receipt = groceryPurchasedMutationReceiptFor(
      run.groceryPurchasedMutationReceipts,
      parsed.data,
      kind,
      target,
    )
    if (receipt) return { response: responseJson(receipt.response) }
  } catch {
    return {
      response: problem(
        'OPERATION_ID_REUSED',
        'Mutation could not be retried',
        'Use a new operation id for this purchased action.',
        409,
      ),
    }
  }
  if (
    parsed.data.baseRevision !== undefined &&
    parsed.data.baseRevision !== run.revision
  )
    return {
      response: problem(
        'RUN_REVISION_CONFLICT',
        'Shopping run changed',
        'Reload the shopping run before changing its groceries.',
        409,
      ),
    }

  const item = (await currentGroceryItems(db, run)).find(
    (candidate) => candidate.id === itemId,
  )
  if (!item)
    return {
      response: problem(
        'GROCERY_ITEM_NOT_FOUND',
        'Grocery item not found',
        'That grocery item is not in the current shopping run.',
        404,
      ),
    }

  const purchasedItems = run.purchasedItems ?? []
  const isPurchased = purchasedItems.some(
    (candidate) => candidate.itemId === itemId,
  )
  if ((action === 'mark' && isPurchased) || (action === 'undo' && !isPurchased))
    return {
      response: responseJson({
        purchased: action === 'mark',
        revision: run.revision,
        detail:
          action === 'mark'
            ? `Marked ${item.ingredientName} purchased.`
            : `Unmarked ${item.ingredientName} as purchased.`,
        code:
          action === 'mark' ? 'GROCERY_PURCHASED' : 'GROCERY_PURCHASED_UNDONE',
      }),
    }

  const nextPurchasedItems =
    action === 'mark'
      ? [
          ...purchasedItems,
          createGroceryPurchasedDocument(itemId, session.user.id),
        ]
      : purchasedItems.filter((candidate) => candidate.itemId !== itemId)
  const response: GroceryPurchasedMutationResponse = {
    purchased: action === 'mark',
    revision: run.revision + 1,
    detail:
      action === 'mark'
        ? `Marked ${item.ingredientName} purchased.`
        : `Unmarked ${item.ingredientName} as purchased.`,
    code: action === 'mark' ? 'GROCERY_PURCHASED' : 'GROCERY_PURCHASED_UNDONE',
  }
  const update =
    action === 'mark'
      ? {
          $set: { purchasedItems: nextPurchasedItems },
          $push: {
            groceryPurchasedMutationReceipts: {
              operationId: parsed.data.operationId,
              clientId: parsed.data.clientId,
              target,
              kind,
              status: 200 as const,
              response,
            },
          },
          $inc: { revision: 1 },
        }
      : {
          $pull: { purchasedItems: { itemId } },
          $push: {
            groceryPurchasedMutationReceipts: {
              operationId: parsed.data.operationId,
              clientId: parsed.data.clientId,
              target,
              kind,
              status: 200 as const,
              response,
            },
          },
          $inc: { revision: 1 },
        }
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: run._id,
      listId,
      state: 'active',
      revision: run.revision,
      ...(action === 'undo' ? { 'purchasedItems.itemId': itemId } : {}),
    },
    update,
    { returnDocument: 'after' },
  )
  if (updatedRun) {
    await publishRunMutationEvent(db, {
      type:
        action === 'mark'
          ? 'grocery.purchased.marked'
          : 'grocery.purchased.undone',
      listId,
      runId: run._id,
      revision: response.revision,
      operationId: parsed.data.operationId,
      actorId: session.user.id,
    }).catch(() => undefined)
    return { response: responseJson(response) }
  }

  const retryRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  try {
    const receipt = groceryPurchasedMutationReceiptFor(
      retryRun?.groceryPurchasedMutationReceipts,
      parsed.data,
      kind,
      target,
    )
    if (receipt) return { response: responseJson(receipt.response) }
  } catch {
    return {
      response: problem(
        'OPERATION_ID_REUSED',
        'Mutation could not be retried',
        'Use a new operation id for this purchased action.',
        409,
      ),
    }
  }
  return {
    response: problem(
      'RUN_REVISION_CONFLICT',
      'Shopping run changed',
      'Reload the shopping run before changing its groceries.',
      409,
    ),
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const result = await loadContext(request, context, 'mark')
    return result.response
  } catch {
    return purchasedStateUnavailable()
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const result = await loadContext(request, context, 'undo')
    return result.response
  } catch {
    return purchasedStateUnavailable()
  }
}
