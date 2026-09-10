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
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'
import {
  createGroceryAmountOverrideDocument,
  groceryAmountOverrideRequestSchema,
  groceryOverrideMutationReceiptFor,
} from '@/lib/recipes/grocery-overrides'

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

function validationFailed(fields?: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the shopping amount',
    status: 422,
    detail: 'Enter a positive shopping amount and retry metadata.',
    code: 'VALIDATION_FAILED',
    ...(fields ? { fields } : {}),
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

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to change a shopping amount.',
      401,
    )

  const { listId, itemId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !listIdSchema.safeParse(itemId).success
  )
    return problem(
      'GROCERY_ITEM_NOT_FOUND',
      'Grocery item not found',
      'That grocery item is not available to you.',
      404,
    )

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationFailed()
  }
  const parsed = groceryAmountOverrideRequestSchema.safeParse(body)
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string[]>>(
      (result, issue) => {
        const field = issue.path[0]?.toString() ?? 'shopping amount'
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

  if (list.activeRunId !== parsed.data.runId) return completedRunProblem()

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const run = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!run)
    return problem(
      'LIST_NOT_ACTIVE',
      'Shopping run unavailable',
      'This list does not have an active shopping run.',
      409,
    )

  const target = `grocery-item:${itemId}:override`
  try {
    const receipt = groceryOverrideMutationReceiptFor(
      run.groceryOverrideMutationReceipts,
      parsed.data,
      'set',
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this shopping amount.',
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

  const item = (await currentGroceryItems(db, run)).find(
    (candidate) => candidate.id === itemId,
  )
  if (!item)
    return problem(
      'GROCERY_ITEM_NOT_FOUND',
      'Grocery item not found',
      'That grocery item is not in the current shopping run.',
      404,
    )
  if (!item.calculatedRequirement)
    return problem(
      'GROCERY_AMOUNT_UNAVAILABLE',
      'Calculated amount unavailable',
      'This item has no calculated requirement to override.',
      422,
    )

  const override = createGroceryAmountOverrideDocument(
    item,
    parsed.data.quantity,
  )
  const groceryAmountOverrides = [
    ...(run.groceryAmountOverrides ?? []).filter(
      (candidate) => candidate.itemId !== itemId,
    ),
    override,
  ]
  const response = {
    override,
    calculatedRequirement: item.calculatedRequirement,
    shoppingAmount: override.quantity,
    revision: run.revision + 1,
    detail: `Shopping amount for ${item.ingredientName} updated.`,
    code: 'GROCERY_AMOUNT_OVERRIDDEN',
  }
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: run._id,
      listId,
      state: 'active',
      revision: run.revision,
    },
    {
      $set: {
        groceryAmountOverrides,
        updatedAt: override.updatedAt,
      },
      $push: {
        groceryOverrideMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target,
          kind: 'set',
          status: 200,
          response,
        },
      },
      $inc: { revision: 1 },
    },
    { returnDocument: 'after' },
  )
  if (updatedRun) {
    await publishRunMutationEvent(db, {
      type: 'grocery.amount-override.set',
      listId,
      runId: run._id,
      revision: response.revision,
      operationId: parsed.data.operationId,
      actorId: session.user.id,
    }).catch(() => undefined)
    return Response.json(response)
  }

  const retryRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  try {
    const receipt = groceryOverrideMutationReceiptFor(
      retryRun?.groceryOverrideMutationReceipts,
      parsed.data,
      'set',
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this shopping amount.',
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

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to reset a shopping amount.',
      401,
    )

  const { listId, itemId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !listIdSchema.safeParse(itemId).success
  )
    return problem(
      'GROCERY_ITEM_NOT_FOUND',
      'Grocery item not found',
      'That grocery item is not available to you.',
      404,
    )

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationFailed()
  }
  const parsed = selectionMutationMetadataSchema.safeParse(body)
  if (!parsed.success) return validationFailed()

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

  if (list.activeRunId !== parsed.data.runId) return completedRunProblem()

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const run = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!run)
    return problem(
      'LIST_NOT_ACTIVE',
      'Shopping run unavailable',
      'This list does not have an active shopping run.',
      409,
    )

  const target = `grocery-item:${itemId}:override`
  try {
    const receipt = groceryOverrideMutationReceiptFor(
      run.groceryOverrideMutationReceipts,
      parsed.data,
      'remove',
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this shopping amount.',
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

  const existingOverride = run.groceryAmountOverrides?.find(
    (candidate) => candidate.itemId === itemId,
  )
  if (!existingOverride)
    return problem(
      'GROCERY_AMOUNT_NOT_OVERRIDDEN',
      'No shopping amount override',
      'This item already uses its calculated requirement.',
      422,
    )

  const item = (await currentGroceryItems(db, run)).find(
    (candidate) => candidate.id === itemId,
  )
  if (!item)
    return problem(
      'GROCERY_ITEM_NOT_FOUND',
      'Grocery item not found',
      'That grocery item is not in the current shopping run.',
      404,
    )

  const response = {
    calculatedRequirement: item.calculatedRequirement,
    shoppingAmount: item.calculatedRequirement,
    revision: run.revision + 1,
    detail: item.calculatedRequirement
      ? `Shopping amount for ${item.ingredientName} reset to calculated requirement.`
      : `Shopping amount for ${item.ingredientName} reset; it is no longer needed by the current run.`,
    code: 'GROCERY_AMOUNT_RESET',
  }
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: run._id,
      listId,
      state: 'active',
      revision: run.revision,
      'groceryAmountOverrides.itemId': itemId,
    },
    {
      $pull: { groceryAmountOverrides: { itemId } },
      $push: {
        groceryOverrideMutationReceipts: {
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
  if (updatedRun) {
    await publishRunMutationEvent(db, {
      type: 'grocery.amount-override.reset',
      listId,
      runId: run._id,
      revision: response.revision,
      operationId: parsed.data.operationId,
      actorId: session.user.id,
    }).catch(() => undefined)
    return Response.json(response)
  }

  const retryRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  try {
    const receipt = groceryOverrideMutationReceiptFor(
      retryRun?.groceryOverrideMutationReceipts,
      parsed.data,
      'remove',
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this shopping amount.',
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
