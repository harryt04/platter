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
import {
  createGroceryMergeSplitDocument,
  grocerySplitMutationReceiptFor,
  splitGroceryContributionRequestSchema,
} from '@/lib/recipes/grocery-splits'

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
    title: 'Check the grocery correction',
    status: 422,
    detail: 'Choose a contribution and retry mutation metadata.',
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
    splitContributionIds:
      run.groceryMergeSplits?.map(({ contributionId }) => contributionId) ?? [],
  })
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to correct a grocery merge.',
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
  const parsed = splitGroceryContributionRequestSchema.safeParse(body)
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string[]>>(
      (result, issue) => {
        const field = issue.path[0]?.toString() ?? 'correction'
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
      'Unarchive this list before correcting its groceries.',
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

  const target = `grocery-item:${itemId}:split:${parsed.data.contributionId}`
  try {
    const receipt = grocerySplitMutationReceiptFor(
      run.grocerySplitMutationReceipts,
      parsed.data,
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this grocery correction.',
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
      'Reload the shopping run before correcting its groceries.',
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
  if (item.contributions.length < 2)
    return problem(
      'GROCERY_ITEM_NOT_MERGED',
      'Grocery item is not merged',
      'Only a combined grocery item can be split.',
      422,
    )
  const contribution = item.contributions.find(
    ({ id }) => id === parsed.data.contributionId,
  )
  if (!contribution)
    return problem(
      'GROCERY_CONTRIBUTION_NOT_FOUND',
      'Contribution not found',
      'That contribution is not part of this grocery item.',
      404,
    )

  const split = createGroceryMergeSplitDocument(itemId, contribution.id)
  const groceryMergeSplits = [...(run.groceryMergeSplits ?? []), split]
  const response = {
    split,
    detail: `Split ${contribution.originalText} into a separate grocery item.`,
    code: 'GROCERY_MERGE_SPLIT',
    revision: run.revision + 1,
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
        groceryMergeSplits,
        updatedAt: split.updatedAt,
      },
      $push: {
        grocerySplitMutationReceipts: {
          operationId: parsed.data.operationId,
          clientId: parsed.data.clientId,
          target,
          kind: 'split',
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
      type: 'grocery.merge-split',
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
    const receipt = grocerySplitMutationReceiptFor(
      retryRun?.grocerySplitMutationReceipts,
      parsed.data,
      target,
    )
    if (receipt) return Response.json(receipt.response)
  } catch {
    return problem(
      'OPERATION_ID_REUSED',
      'Mutation could not be retried',
      'Use a new operation id for this grocery correction.',
      409,
    )
  }
  return problem(
    'RUN_REVISION_CONFLICT',
    'Shopping run changed',
    'Reload the shopping run before correcting its groceries.',
    409,
  )
}
