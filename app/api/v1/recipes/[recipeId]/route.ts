import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import {
  privateDraftFilter,
  toRecipeDraft,
  updateDraftSchema,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'

type RouteContext = { params: Promise<{ recipeId: string }> }

async function ownedDraft(recipeId: string, ownerId: string) {
  const db = await getConnectedDatabase()
  return db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(privateDraftFilter(ownerId, recipeId))
}

function notFoundResponse() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-not-found',
    title: 'Recipe not found',
    status: 404,
    detail: 'That recipe is not available.',
    code: 'RECIPE_NOT_FOUND',
  })
}

function authenticationRequired(detail: string) {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail,
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function invalidJson(detail = 'Send a JSON object with a recipe title.') {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail,
    code: 'INVALID_JSON',
  })
}

function invalidTitle(issues: string[]) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the recipe title',
    status: 422,
    detail: 'A recipe draft needs a title.',
    code: 'VALIDATION_FAILED',
    fields: { title: issues },
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to view your recipes.')

  const { recipeId } = await context.params
  const draft = await ownedDraft(recipeId, session.user.id)
  return draft
    ? Response.json({ recipe: toRecipeDraft(draft) })
    : notFoundResponse()
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to edit your recipes.')

  const { recipeId } = await context.params
  const draft = await ownedDraft(recipeId, session.user.id)
  if (!draft) return notFoundResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = updateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return invalidTitle(parsed.error.issues.map((issue) => issue.message))
  }

  const updatedAt = isoDateTime(new Date())
  const db = await getConnectedDatabase()
  await db
    .collection<RecipeDraftDocument>('recipes')
    .updateOne(privateDraftFilter(session.user.id, recipeId), {
      $set: { title: parsed.data.title, updatedAt },
    })
  return Response.json({
    recipe: toRecipeDraft({ ...draft, title: parsed.data.title, updatedAt }),
  })
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to delete your recipes.')

  const { recipeId } = await context.params
  const draft = await ownedDraft(recipeId, session.user.id)
  if (!draft) return notFoundResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson('Confirm the recipe title before deleting it.')
  }

  const confirmation =
    typeof body === 'object' && body !== null && 'title' in body
      ? body.title
      : undefined
  if (confirmation !== draft.title) {
    return problemResponse({
      type: 'https://platter.dev/problems/confirmation-mismatch',
      title: 'Confirmation did not match',
      status: 422,
      detail: 'Type the recipe title exactly to confirm deletion.',
      code: 'CONFIRMATION_MISMATCH',
      fields: { title: ['Type the recipe title exactly to confirm deletion.'] },
    })
  }

  const db = await getConnectedDatabase()
  await db
    .collection<RecipeDraftDocument>('recipes')
    .deleteOne(privateDraftFilter(session.user.id, recipeId))
  return new Response(null, { status: 204 })
}
