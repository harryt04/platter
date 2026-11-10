import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { opaqueCursorSchema } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import {
  decodeRecipeLibraryCursor,
  recipeDraftCreationResponseSchema,
  recipeLibraryPageResponseSchema,
  searchRecipeLibrary,
} from '@/lib/recipes/library'
import {
  createDraftDocument,
  createDraftSchema,
  createRecipeVersionDocument,
  recipeVersions,
  toRecipeDraft,
  type RecipeDraftDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import { z } from 'zod'

const librarySearchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search terms must be 100 characters or fewer.')
    .default(''),
  cursor: opaqueCursorSchema.optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

function libraryUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-library-unavailable',
    title: 'Recipe library temporarily unavailable',
    status: 503,
    detail: 'Your recipe library could not be loaded. Try again shortly.',
    code: 'RECIPE_LIBRARY_UNAVAILABLE',
  })
}

function recipeCreationUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-creation-failed',
    title: 'Recipe creation temporarily unavailable',
    status: 503,
    detail: 'Your recipe draft could not be created. Try again shortly.',
    code: 'RECIPE_CREATION_FAILED',
  })
}

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession()
  } catch {
    return libraryUnavailable()
  }
  if (!session) {
    return problemResponse({
      type: 'https://platter.dev/problems/authentication-required',
      title: 'Authentication required',
      status: 401,
      detail: 'Sign in to view your recipes.',
      code: 'AUTHENTICATION_REQUIRED',
    })
  }

  const url = new URL(request.url)
  const parsed = librarySearchParamsSchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    cursor: url.searchParams.get('cursor') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  })
  if (
    !parsed.success ||
    (parsed.data.cursor && !decodeRecipeLibraryCursor(parsed.data.cursor))
  ) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the library search',
      status: 422,
      detail: 'Use a valid library search and pagination cursor.',
      code: 'VALIDATION_FAILED',
    })
  }

  try {
    const db = await getConnectedDatabase()
    const page = await searchRecipeLibrary(db, session.user.id, {
      text: parsed.data.q,
      cursor: parsed.data.cursor,
      pageSize: parsed.data.pageSize,
    })
    const response = recipeLibraryPageResponseSchema.safeParse({
      recipes: page.entries.map(({ recipe, access, sharedListNames }) => ({
        ...recipe,
        libraryAccess: access,
        ...(sharedListNames.length ? { sharedListNames } : {}),
      })),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    })
    if (!response.success) return libraryUnavailable()

    return Response.json(response.data)
  } catch {
    return libraryUnavailable()
  }
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession()
  } catch {
    return recipeCreationUnavailable()
  }
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

  try {
    const draft = createDraftDocument(session.user.id, parsed.data.title)
    const db = await getConnectedDatabase()
    await db.collection<RecipeDraftDocument>('recipes').insertOne(draft)
    const version = createRecipeVersionDocument(draft)
    const { _id: versionId, ...versionContent } = version
    await recipeVersions(
      db.collection<RecipeVersionDocument>('recipe_versions'),
    ).insertOne({ _id: versionId, ...versionContent })
    const response = recipeDraftCreationResponseSchema.safeParse({
      recipe: toRecipeDraft(draft),
    })
    if (!response.success) return recipeCreationUnavailable()
    return Response.json(response.data, { status: 201 })
  } catch {
    return recipeCreationUnavailable()
  }
}
