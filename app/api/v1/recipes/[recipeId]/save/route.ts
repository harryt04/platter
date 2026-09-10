import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { problemResponse } from '@/lib/contracts/problem'
import {
  publicRecipeFilter,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'
import {
  createRecipeSaveDocument,
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

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { recipeId } = await context.params
  const db = await getConnectedDatabase()
  const recipe = await db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(publicRecipeFilter(recipeId))
  if (!recipe) return recipeNotFound()

  await recipeSaves(
    db.collection<RecipeSaveDocument>('recipe_saves'),
  ).updateOne(
    { userId: session.user.id, recipeId },
    { $setOnInsert: createRecipeSaveDocument(session.user.id, recipeId) },
    { upsert: true },
  )
  return Response.json({ recipeId, saved: true })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { recipeId } = await context.params
  const db = await getConnectedDatabase()
  await recipeSaves(
    db.collection<RecipeSaveDocument>('recipe_saves'),
  ).deleteOne({ userId: session.user.id, recipeId })
  return Response.json({ recipeId, saved: false })
}
