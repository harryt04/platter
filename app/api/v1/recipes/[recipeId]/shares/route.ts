import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import {
  createRecipeShareDocument,
  ownedRecipeFilter,
  recipeShareFilter,
  recipeShareUpdateSchema,
  recipeIdSchema,
  recipeShares,
  type RecipeDraftDocument,
  type RecipeShareDocument,
} from '@/lib/recipes/drafts'

type RouteContext = { params: Promise<{ recipeId: string }> }

function authenticationRequired(detail: string) {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail,
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function recipeNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-not-found',
    title: 'Recipe not found',
    status: 404,
    detail: 'That recipe is not available.',
    code: 'RECIPE_NOT_FOUND',
  })
}

function validationFailed(detail: string, fields?: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the sharing details',
    status: 422,
    detail,
    code: 'VALIDATION_FAILED',
    ...(fields ? { fields } : {}),
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send a JSON object with the lists to share with.',
    code: 'INVALID_JSON',
  })
}

async function ownedRecipe(recipeId: string, ownerId: string) {
  const db = await getConnectedDatabase()
  return db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(ownedRecipeFilter(ownerId, recipeId))
}

async function memberLists(userId: string) {
  const db = await getConnectedDatabase()
  return db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(userId))
    .toArray()
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session)
    return authenticationRequired('Sign in to manage recipe sharing.')

  const { recipeId } = await context.params
  if (!recipeIdSchema.safeParse(recipeId).success) return recipeNotFound()
  const recipe = await ownedRecipe(recipeId, session.user.id)
  if (!recipe) return recipeNotFound()

  const [lists, shares] = await Promise.all([
    memberLists(session.user.id),
    (async () => {
      const db = await getConnectedDatabase()
      return recipeShares(db.collection<RecipeShareDocument>('recipe_shares'))
        .find(recipeShareFilter(recipeId))
        .toArray()
    })(),
  ])
  const sharedListIds = new Set(shares.map((share) => share.listId))

  return Response.json({
    visibility: recipe.visibility,
    lists: lists.map((list) => ({
      id: list._id,
      name: list.name,
      status: list.status,
      shared: sharedListIds.has(list._id),
    })),
  })
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to share a recipe.')

  const { recipeId } = await context.params
  if (!recipeIdSchema.safeParse(recipeId).success) return recipeNotFound()
  const recipe = await ownedRecipe(recipeId, session.user.id)
  if (!recipe) return recipeNotFound()
  if (
    (recipe.origin ?? 'authored') !== 'authored' ||
    recipe.status !== 'usable'
  ) {
    return validationFailed(
      'Complete this authored recipe before sharing it with a list.',
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = recipeShareUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return validationFailed(
      'Choose one or more valid lists, or leave the selection empty to keep this recipe private.',
      { listIds: parsed.error.issues.map((issue) => issue.message) },
    )
  }

  const db = await getConnectedDatabase()
  const targetListIds = parsed.data.publishPublic ? [] : parsed.data.listIds
  const lists = parsed.data.publishPublic
    ? []
    : await db
        .collection<ListDocument>('lists')
        .find({
          ...listMembershipFilter(session.user.id),
          status: 'active',
          _id: { $in: targetListIds },
        })
        .toArray()
  const allowedListIds = new Set(lists.map((list) => list._id))
  const unauthorizedListIds = targetListIds.filter(
    (listId) => !allowedListIds.has(listId),
  )
  if (unauthorizedListIds.length > 0) {
    return validationFailed(
      'Choose lists you currently belong to. Deleted lists cannot receive recipe sharing.',
      { listIds: ['One or more selected lists are not available.'] },
    )
  }

  const shareCollection = recipeShares(
    db.collection<RecipeShareDocument>('recipe_shares'),
  )
  const currentShares = await shareCollection
    .find(recipeShareFilter(recipeId))
    .toArray()
  const selectedListIds = new Set(
    parsed.data.publishPublic ? [] : parsed.data.listIds,
  )
  const currentListIds = new Set(currentShares.map((share) => share.listId))

  await shareCollection.deleteMany({
    ...recipeShareFilter(recipeId),
    listId: { $nin: targetListIds },
  })
  const newShares = targetListIds
    .filter((listId) => !currentListIds.has(listId))
    .map((listId) =>
      createRecipeShareDocument(recipeId, listId, session.user.id),
    )
  if (newShares.length > 0) await shareCollection.insertMany(newShares)

  const visibility = parsed.data.publishPublic
    ? 'public'
    : selectedListIds.size > 0
      ? 'list-shared'
      : 'private'
  await db
    .collection<RecipeDraftDocument>('recipes')
    .updateOne(ownedRecipeFilter(session.user.id, recipeId), {
      $set: { visibility },
    })

  return Response.json({
    visibility,
    listIds: [...selectedListIds],
  })
}
