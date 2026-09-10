import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'
import { generateGroceryItems } from '@/lib/recipes/groceries'
import {
  createGroceryAlreadyHaveDocument,
  groceryAlreadyHaveMutationReceiptFor,
  groceryAlreadyHaveRequestSchema,
  type GroceryAlreadyHaveMutationReceipt,
} from '@/lib/recipes/grocery-already-have'

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
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the already-have action',
    status: 422,
    detail: 'Include valid retry metadata and try again.',
    code: 'VALIDATION_FAILED',
  })
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
          ? 'Sign in to mark groceries already have.'
          : 'Sign in to restore groceries to the buy view.',
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
  const parsed = groceryAlreadyHaveRequestSchema.safeParse(body)
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

  const target = `grocery-item:${itemId}:already-have`
  const kind: GroceryAlreadyHaveMutationReceipt['kind'] =
    action === 'mark' ? 'set' : 'remove'
  try {
    const receipt = groceryAlreadyHaveMutationReceiptFor(
      run.groceryAlreadyHaveMutationReceipts,
      parsed.data,
      kind,
      target,
    )
    if (receipt) return { response: Response.json(receipt.response) }
  } catch {
    return {
      response: problem(
        'OPERATION_ID_REUSED',
        'Mutation could not be retried',
        'Use a new operation id for this already-have action.',
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

  const alreadyHaveItems = run.alreadyHaveItems ?? []
  const isAlreadyHave = alreadyHaveItems.some(
    (candidate) => candidate.itemId === itemId,
  )
  if (
    (action === 'mark' && isAlreadyHave) ||
    (action === 'undo' && !isAlreadyHave)
  )
    return {
      response: Response.json({
        alreadyHave: action === 'mark',
        revision: run.revision,
        detail:
          action === 'mark'
            ? `Marked ${item.ingredientName} already have. It’s hidden from your buy view.`
            : `Added ${item.ingredientName} back to your buy view.`,
        code:
          action === 'mark'
            ? 'GROCERY_ALREADY_HAVE'
            : 'GROCERY_ALREADY_HAVE_UNDONE',
      }),
    }

  const nextAlreadyHaveItems =
    action === 'mark'
      ? [...alreadyHaveItems, createGroceryAlreadyHaveDocument(itemId)]
      : alreadyHaveItems.filter((candidate) => candidate.itemId !== itemId)
  const response = {
    alreadyHave: action === 'mark',
    revision: run.revision + 1,
    detail:
      action === 'mark'
        ? `Marked ${item.ingredientName} already have. It’s hidden from your buy view.`
        : `Added ${item.ingredientName} back to your buy view.`,
    code:
      action === 'mark'
        ? 'GROCERY_ALREADY_HAVE'
        : 'GROCERY_ALREADY_HAVE_UNDONE',
  }
  const update =
    action === 'mark'
      ? {
          $set: { alreadyHaveItems: nextAlreadyHaveItems },
          $push: {
            groceryAlreadyHaveMutationReceipts: {
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
          $pull: { alreadyHaveItems: { itemId } },
          $push: {
            groceryAlreadyHaveMutationReceipts: {
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
      ...(action === 'undo' ? { 'alreadyHaveItems.itemId': itemId } : {}),
    },
    update,
    { returnDocument: 'after' },
  )
  if (updatedRun) return { response: Response.json(response) }

  const retryRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  try {
    const receipt = groceryAlreadyHaveMutationReceiptFor(
      retryRun?.groceryAlreadyHaveMutationReceipts,
      parsed.data,
      kind,
      target,
    )
    if (receipt) return { response: Response.json(receipt.response) }
  } catch {
    return {
      response: problem(
        'OPERATION_ID_REUSED',
        'Mutation could not be retried',
        'Use a new operation id for this already-have action.',
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
  const result = await loadContext(request, context, 'mark')
  return result.response
}

export async function DELETE(request: Request, context: RouteContext) {
  const result = await loadContext(request, context, 'undo')
  return result.response
}
