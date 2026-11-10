import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  recipeImportIdSchema,
  recipeImportOwnerFilter,
  recipeImportSummarySchema,
  toRecipeImportSummary,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'
import {
  checkRateLimit,
  rateLimitProblemResponse,
} from '@/lib/security/rate-limit'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to view an import status.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function notFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/import-not-found',
    title: 'Import not found',
    status: 404,
    detail: 'That import is not available to you.',
    code: 'IMPORT_NOT_FOUND',
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ importId: string }> },
) {
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

  const { importId } = await context.params
  if (!recipeImportIdSchema.safeParse(importId).success) return notFound()

  try {
    const db = await getConnectedDatabase()
    const document = await db
      .collection<RecipeImportDocument>('recipe_imports')
      .findOne(recipeImportOwnerFilter(importId, session.user.id))
    if (!document) return notFound()

    const summary = recipeImportSummarySchema.parse(
      toRecipeImportSummary(document),
    )
    return Response.json({ import: summary })
  } catch {
    return importStatusUnavailable()
  }
}
