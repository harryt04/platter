import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { isoDateTime } from '@/lib/contracts/ids'
import {
  createRecipeImportDocument,
  recipeImports,
  submitRecipeImportSchema,
  toRecipeImportSummary,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'
import { enqueueRecipeImport } from '@/lib/jobs/queue'
import { checkRateLimit } from '@/lib/security/rate-limit'

const IMPORT_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to import a recipe URL.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function rateLimited(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({
      type: 'https://platter.dev/problems/rate-limited',
      title: 'Too many import attempts',
      status: 429,
      detail: 'Wait before submitting another recipe URL.',
      code: 'RATE_LIMITED',
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/problem+json',
        'retry-after': String(retryAfterSeconds),
      },
    },
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const db = await getConnectedDatabase()
  const imports = await recipeImports(
    db.collection<RecipeImportDocument>('recipe_imports'),
  )
    .find({ userId: session.user.id })
    .sort({ submittedAt: -1, _id: -1 })
    .limit(50)
    .toArray()

  return Response.json({
    imports: imports.map(toRecipeImportSummary),
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const limit = checkRateLimit(
    `recipe-import-submit:${session.user.id}`,
    IMPORT_RATE_LIMIT,
  )
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/invalid-json',
      title: 'Invalid request',
      status: 400,
      detail: 'Send a JSON object containing a recipe URL.',
      code: 'INVALID_JSON',
    })
  }

  const parsed = submitRecipeImportSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the recipe URL',
      status: 422,
      detail: 'Only HTTP and HTTPS recipe URLs can be imported.',
      code: 'VALIDATION_FAILED',
      fields: { sourceUrl: parsed.error.issues.map((issue) => issue.message) },
    })
  }

  const db = await getConnectedDatabase()
  const document = createRecipeImportDocument(
    session.user.id,
    parsed.data.sourceUrl,
  )
  await recipeImports(
    db.collection<RecipeImportDocument>('recipe_imports'),
  ).insertOne(document)

  try {
    await enqueueRecipeImport(db, document._id, document.sourceUrl)
  } catch {
    await db.collection<RecipeImportDocument>('recipe_imports').updateOne(
      { _id: document._id, userId: session.user.id },
      {
        $set: {
          status: 'failed',
          failureCode: 'IMPORT_QUEUE_UNAVAILABLE',
          updatedAt: isoDateTime(new Date()),
        },
      },
    )
    return problemResponse({
      type: 'https://platter.dev/problems/import-queue-unavailable',
      title: 'Import could not be queued',
      status: 503,
      detail:
        'The URL was recorded, but the import worker is unavailable. Try again later.',
      code: 'IMPORT_QUEUE_UNAVAILABLE',
    })
  }

  return Response.json(
    { import: toRecipeImportSummary(document) },
    { status: 202 },
  )
}
