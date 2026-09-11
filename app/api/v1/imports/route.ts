import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { isoDateTime } from '@/lib/contracts/ids'
import { publicCatalogImportsEnabled } from '@/lib/instance-policy'
import {
  createRecipeImportDocument,
  recipeImportIdempotencyKeySchema,
  recipeImports,
  submitRecipeImportSchema,
  recipeImportSummarySchema,
  toRecipeImportSummary,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'
import { enqueueRecipeImport } from '@/lib/jobs/queue'
import {
  checkRateLimit,
  rateLimitProblemResponse,
} from '@/lib/security/rate-limit'

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

function publicImportsDisabled() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-imports-disabled',
    title: 'Public imports are disabled',
    status: 503,
    detail:
      'This instance has disabled new public URL imports. Manual recipes, existing saved recipes, and shopping remain available.',
    code: 'PUBLIC_IMPORTS_DISABLED',
  })
}

function rateLimited(retryAfterSeconds: number) {
  return rateLimitProblemResponse({
    title: 'Too many import attempts',
    detail: 'Wait before submitting another recipe URL.',
    retryAfterSeconds,
  })
}

function invalidIdempotencyKey() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-idempotency-key',
    title: 'Invalid idempotency key',
    status: 422,
    detail:
      'Send a unique printable Idempotency-Key header with each new import.',
    code: 'INVALID_IDEMPOTENCY_KEY',
  })
}

function idempotencyConflict() {
  return problemResponse({
    type: 'https://platter.dev/problems/idempotency-key-reused',
    title: 'Idempotency key already used',
    status: 409,
    detail: 'Use a new Idempotency-Key when importing a different URL.',
    code: 'IDEMPOTENCY_KEY_REUSED',
  })
}

function importStatusUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/import-status-unavailable',
    title: 'Import status is temporarily unavailable',
    status: 503,
    detail: 'Import status could not be loaded. Try again shortly.',
    code: 'IMPORT_STATUS_UNAVAILABLE',
  })
}

function isDuplicateKeyError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 11000
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const limit = checkRateLimit(`recipe-import-status:${session.user.id}`, {
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.allowed) {
    return rateLimitProblemResponse({
      title: 'Import status limit reached',
      detail: 'Wait before requesting import status again.',
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  try {
    const db = await getConnectedDatabase()
    const imports = await recipeImports(
      db.collection<RecipeImportDocument>('recipe_imports'),
    )
      .find({ userId: session.user.id })
      .sort({ submittedAt: -1, _id: -1 })
      .limit(50)
      .toArray()

    const summaries = imports.map((document) =>
      recipeImportSummarySchema.parse(toRecipeImportSummary(document)),
    )
    return Response.json({ imports: summaries })
  } catch {
    return importStatusUnavailable()
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (!publicCatalogImportsEnabled()) return publicImportsDisabled()

  const idempotencyKey = request.headers.get('idempotency-key')
  const parsedIdempotencyKey =
    recipeImportIdempotencyKeySchema.safeParse(idempotencyKey)
  if (!parsedIdempotencyKey.success) return invalidIdempotencyKey()

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
  const collection = recipeImports(
    db.collection<RecipeImportDocument>('recipe_imports'),
  )
  const existing = await collection.findOne({
    userId: session.user.id,
    idempotencyKey: parsedIdempotencyKey.data,
  })
  if (existing) {
    if (existing.sourceUrl !== parsed.data.sourceUrl) {
      return idempotencyConflict()
    }
    return Response.json(
      { import: toRecipeImportSummary(existing) },
      { status: 202 },
    )
  }

  const document = createRecipeImportDocument(
    session.user.id,
    parsedIdempotencyKey.data,
    parsed.data.sourceUrl,
  )
  try {
    await collection.insertOne(document)
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    const raced = await collection.findOne({
      userId: session.user.id,
      idempotencyKey: parsedIdempotencyKey.data,
    })
    if (!raced) throw error
    if (raced.sourceUrl !== parsed.data.sourceUrl) {
      return idempotencyConflict()
    }
    return Response.json(
      { import: toRecipeImportSummary(raced) },
      { status: 202 },
    )
  }

  try {
    await enqueueRecipeImport(db, {
      importId: document._id,
      userId: document.userId,
      idempotencyKey: document.idempotencyKey,
      jobGeneration: document.jobGeneration,
    })
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
