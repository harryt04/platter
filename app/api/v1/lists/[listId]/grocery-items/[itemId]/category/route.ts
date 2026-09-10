import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import {
  createGroceryCategoryOverrideDocument,
  groceryCategoryOverrideMutationReceiptFor,
  groceryCategoryOverrideRequestSchema,
} from '@/lib/recipes/grocery-categories-overrides'
import { generateGroceryItems } from '@/lib/recipes/groceries'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'

type RouteContext = { params: Promise<{ listId: string; itemId: string }> }

function problem(code: string, title: string, detail: string, status: number) {
  return problemResponse({
    type: `https://platter.dev/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    detail,
    code,
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
    categoryOverrides: run.groceryCategoryOverrides ?? [],
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
      'Sign in to change grocery categories.',
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
    body = null
  }
  const parsed = groceryCategoryOverrideRequestSchema.safeParse(body)
  if (!parsed.success)
    return problem(
      'VALIDATION_FAILED',
      'Check the category action',
      'Choose a valid category and include valid retry metadata.',
      422,
    )

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

  const target = `grocery-item:${itemId}:category`
  try {
    const receipt = groceryCategoryOverrideMutationReceiptFor(
      run.groceryCategoryOverrideMutationReceipts,
      parsed.data,
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this category action.',
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

  const existing = run.groceryCategoryOverrides?.find(
    (candidate) => candidate.itemId === itemId,
  )
  if (existing?.category === parsed.data.category)
    return Response.json({
      category: existing.category,
      revision: run.revision,
      detail: `${item.ingredientName} is already in this category.`,
      code: 'GROCERY_CATEGORY_UNCHANGED',
    })

  const categoryOverrides = [
    ...(run.groceryCategoryOverrides ?? []).filter(
      (candidate) => candidate.itemId !== itemId,
    ),
    createGroceryCategoryOverrideDocument(itemId, parsed.data.category),
  ]
  const response = {
    category: parsed.data.category,
    revision: run.revision + 1,
    detail: `Moved ${item.ingredientName} to ${parsed.data.category.replaceAll('-', ' ')}.`,
    code: 'GROCERY_CATEGORY_CHANGED',
  }
  const update = {
    $set: { groceryCategoryOverrides: categoryOverrides },
    $push: {
      groceryCategoryOverrideMutationReceipts: {
        operationId: parsed.data.operationId,
        clientId: parsed.data.clientId,
        target,
        kind: 'set' as const,
        status: 200 as const,
        response,
      },
    },
    $inc: { revision: 1 },
  }
  const updated = await runs.findOneAndUpdate(
    { _id: run._id, listId, state: 'active', revision: run.revision },
    update,
    { returnDocument: 'after' },
  )
  if (updated) return Response.json(response)

  const retryRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  try {
    const receipt = groceryCategoryOverrideMutationReceiptFor(
      retryRun?.groceryCategoryOverrideMutationReceipts,
      parsed.data,
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this category action.',
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
