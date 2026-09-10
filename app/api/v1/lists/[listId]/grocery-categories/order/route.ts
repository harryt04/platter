import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { publishRunMutationEvent } from '@/lib/realtime/events'
import { completedRunProblem } from '@/lib/contracts/run-mutation'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import {
  currentCategoryOrder,
  groceryCategoryOrderMutationReceiptFor,
  groceryCategoryOrderRequestSchema,
} from '@/lib/recipes/grocery-category-ordering'
import { groupGroceryItemsByDefaultCategory } from '@/lib/recipes/grocery-categories'
import { generateGroceryItems } from '@/lib/recipes/groceries'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'

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

async function currentCategories(
  db: Awaited<ReturnType<typeof getConnectedDatabase>>,
  run: ShoppingRunDocument,
) {
  const resolvedSelections = await resolveRunRecipeVersions(
    db,
    run.recipeSelections,
  )
  const groceryItems = generateGroceryItems({
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
  return groupGroceryItemsByDefaultCategory(groceryItems).map(
    ({ category }) => category,
  )
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to reorder grocery categories.',
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
    body = null
  }
  const parsed = groceryCategoryOrderRequestSchema.safeParse(body)
  if (!parsed.success)
    return problem(
      'VALIDATION_FAILED',
      'Check the category move',
      'Choose current grocery categories and include valid retry metadata.',
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
      'Unarchive this list before reordering its groceries.',
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

  const target = `grocery-category:${parsed.data.category}:order`
  try {
    const receipt = groceryCategoryOrderMutationReceiptFor(
      run.groceryCategoryOrderMutationReceipts,
      parsed.data,
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this move.',
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
      'Reload the shopping run before reordering groceries.',
      409,
    )

  const categories = await currentCategories(db, run)
  if (
    !categories.includes(parsed.data.category) ||
    !categories.includes(parsed.data.targetCategory)
  )
    return problem(
      'GROCERY_CATEGORY_NOT_FOUND',
      'Grocery category not found',
      'That category is not in the current shopping run.',
      404,
    )

  const ordering = currentCategoryOrder(run.categoryOrdering, categories)
  const sourceIndex = ordering.indexOf(parsed.data.category)
  const targetIndex = ordering.indexOf(parsed.data.targetCategory)
  if (sourceIndex === targetIndex)
    return Response.json({
      revision: run.revision,
      detail: 'That grocery category is already in place.',
      code: 'GROCERY_CATEGORY_ORDER_UNCHANGED',
    })
  const nextOrdering = ordering.filter(
    (category) => category !== parsed.data.category,
  )
  const adjustedTargetIndex = nextOrdering.indexOf(parsed.data.targetCategory)
  nextOrdering.splice(
    adjustedTargetIndex + (parsed.data.placement === 'after' ? 1 : 0),
    0,
    parsed.data.category,
  )
  const response = {
    revision: run.revision + 1,
    detail: `Moved ${parsed.data.category.replaceAll('-', ' ')} ${parsed.data.placement} ${parsed.data.targetCategory.replaceAll('-', ' ')}.`,
    code: 'GROCERY_CATEGORY_ORDER_CHANGED',
  }
  const updated = await runs.findOneAndUpdate(
    { _id: run._id, listId, state: 'active', revision: run.revision },
    {
      $set: { categoryOrdering: nextOrdering },
      $push: {
        groceryCategoryOrderMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target,
          kind: 'move' as const,
          status: 200 as const,
          response,
        },
      },
      $inc: { revision: 1 },
    },
    { returnDocument: 'after' },
  )
  if (updated) {
    await publishRunMutationEvent(db, {
      type: 'grocery.category.moved',
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
    const receipt = groceryCategoryOrderMutationReceiptFor(
      retryRun?.groceryCategoryOrderMutationReceipts,
      parsed.data,
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this move.',
      409,
    )
  }
  return problem(
    'RUN_REVISION_CONFLICT',
    'Shopping run changed',
    'Reload the shopping run before reordering groceries.',
    409,
  )
}
