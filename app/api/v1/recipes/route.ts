import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import {
  createDraftDocument,
  createDraftSchema,
  toRecipeDraft,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return problemResponse({
      type: 'https://platter.dev/problems/authentication-required',
      title: 'Authentication required',
      status: 401,
      detail: 'Sign in to view your recipes.',
      code: 'AUTHENTICATION_REQUIRED',
    })
  }

  const db = await getConnectedDatabase()
  const drafts = await db
    .collection<RecipeDraftDocument>('recipes')
    .find({
      ownerId: session.user.id,
      status: { $in: ['draft', 'usable'] },
      visibility: 'private',
    })
    .sort({ updatedAt: -1 })
    .toArray()

  return Response.json({ recipes: drafts.map(toRecipeDraft) })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return problemResponse({
      type: 'https://platter.dev/problems/authentication-required',
      title: 'Authentication required',
      status: 401,
      detail: 'Sign in to save a recipe draft.',
      code: 'AUTHENTICATION_REQUIRED',
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/invalid-json',
      title: 'Invalid request',
      status: 400,
      detail: 'Send a JSON object with a recipe title.',
      code: 'INVALID_JSON',
    })
  }

  const parsed = createDraftSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the recipe title',
      status: 422,
      detail: 'A recipe draft needs a title.',
      code: 'VALIDATION_FAILED',
      fields: { title: parsed.error.issues.map((issue) => issue.message) },
    })
  }

  const draft = createDraftDocument(session.user.id, parsed.data.title)
  const db = await getConnectedDatabase()
  await db.collection<RecipeDraftDocument>('recipes').insertOne(draft)
  return Response.json({ recipe: toRecipeDraft(draft) }, { status: 201 })
}
