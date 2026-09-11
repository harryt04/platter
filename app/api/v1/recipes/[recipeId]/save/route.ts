import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { problemResponse } from '@/lib/contracts/problem'
import {
  publicRecipeFilter,
  recipeIdSchema,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'
import {
  createRecipeSaveDocument,
  publicRecipeSaveTargetSchema,
  recipeSaveResponseSchema,
  recipeSaves,
  type RecipeSaveDocument,
} from '@/lib/recipes/saves'

type RouteContext = { params: Promise<{ recipeId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to save public recipes.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function recipeNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-not-found',
    title: 'Recipe not found',
    status: 404,
    detail: 'That public recipe is not available to save.',
    code: 'RECIPE_NOT_FOUND',
  })
}

function saveUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-save-unavailable',
    title: 'Recipe save temporarily unavailable',
    status: 503,
    detail:
      'That saved recipe action could not be completed. Try again shortly.',
    code: 'RECIPE_SAVE_UNAVAILABLE',
  })
}

function saveResponse(recipeId: string, saved: boolean) {
  const response = recipeSaveResponseSchema.safeParse({ recipeId, saved })
  return response.success ? Response.json(response.data) : saveUnavailable()
}

export async function POST(_request: Request, context: RouteContext) {
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession()
  } catch {
    return saveUnavailable()
  }
  if (!session) return authenticationRequired()

  const { recipeId } = await context.params
  if (!recipeIdSchema.safeParse(recipeId).success) return recipeNotFound()
  try {
    const db = await getConnectedDatabase()
    const recipe = await db
      .collection<RecipeDraftDocument>('recipes')
      .findOne(publicRecipeFilter(recipeId), {
        projection: {
          _id: 1,
          status: 1,
          visibility: 1,
          origin: 1,
          importReviewStatus: 1,
        },
      })
    if (!recipe) return recipeNotFound()
    if (!publicRecipeSaveTargetSchema.safeParse(recipe).success) {
      return saveUnavailable()
    }

    await recipeSaves(
      db.collection<RecipeSaveDocument>('recipe_saves'),
    ).updateOne(
      { userId: session.user.id, recipeId },
      { $setOnInsert: createRecipeSaveDocument(session.user.id, recipeId) },
      { upsert: true },
    )
    return saveResponse(recipeId, true)
  } catch {
    return saveUnavailable()
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession()
  } catch {
    return saveUnavailable()
  }
  if (!session) return authenticationRequired()

  const { recipeId } = await context.params
  if (!recipeIdSchema.safeParse(recipeId).success) return recipeNotFound()
  try {
    const db = await getConnectedDatabase()
    await recipeSaves(
      db.collection<RecipeSaveDocument>('recipe_saves'),
    ).deleteOne({ userId: session.user.id, recipeId })
    return saveResponse(recipeId, false)
  } catch {
    return saveUnavailable()
  }
}
