import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { serverEnv } from '@/lib/env/server'
import { enqueueRecipeImport } from '@/lib/jobs/queue'
import {
  recipeImportIdSchema,
  recipeImportOwnerFilter,
  toRecipeImportSummary,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'
import { checkRateLimit } from '@/lib/security/rate-limit'

const retryRequestSchema = z.object({
  action: z.enum(['retry', 'reprocess']),
})

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to retry a recipe import.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function publicImportsDisabled() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-imports-disabled',
    title: 'Public imports are disabled',
    status: 503,
    detail:
      'This instance has disabled new public URL imports. Existing saved recipes remain available.',
    code: 'PUBLIC_IMPORTS_DISABLED',
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

function invalidRequest() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Choose a recovery action',
    status: 422,
    detail: 'Choose whether to retry a failed import or reprocess a preview.',
    code: 'VALIDATION_FAILED',
  })
}

function notRetryable() {
  return problemResponse({
    type: 'https://platter.dev/problems/import-not-retryable',
    title: 'Import is not ready for that action',
    status: 409,
    detail:
      'Failed imports can be retried, and completed previews can be reprocessed.',
    code: 'IMPORT_NOT_RETRYABLE',
  })
}

function queueUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/import-queue-unavailable',
    title: 'Import could not be queued',
    status: 503,
    detail: 'The import was reset safely, but the worker is unavailable.',
    code: 'IMPORT_QUEUE_UNAVAILABLE',
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ importId: string }> },
) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (!serverEnv().RECIPE_IMPORTS_ENABLED) return publicImportsDisabled()

  const limit = checkRateLimit(`recipe-import-retry:${session.user.id}`, {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: { 'retry-after': String(limit.retryAfterSeconds) },
    })
  }

  const { importId } = await context.params
  if (!recipeImportIdSchema.safeParse(importId).success) return notFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidRequest()
  }
  const parsed = retryRequestSchema.safeParse(body)
  if (!parsed.success) return invalidRequest()

  const db = await getConnectedDatabase()
  const imports = db.collection<RecipeImportDocument>('recipe_imports')
  const existing = await imports.findOne(
    recipeImportOwnerFilter(importId, session.user.id),
  )
  if (!existing) return notFound()

  const eligibleStatuses: RecipeImportDocument['status'][] =
    parsed.data.action === 'retry' ? ['failed'] : ['preview-ready']
  if (!eligibleStatuses.includes(existing.status)) {
    if (['queued', 'processing', 'retrying'].includes(existing.status)) {
      return Response.json(
        { import: toRecipeImportSummary(existing) },
        { status: 202 },
      )
    }
    return notRetryable()
  }

  const jobGeneration = randomUUID()
  const queued = await imports.findOneAndUpdate(
    {
      ...recipeImportOwnerFilter(importId, session.user.id),
      status: { $in: eligibleStatuses },
    },
    {
      $set: {
        status: 'queued',
        attemptCount: 0,
        jobGeneration,
        updatedAt: isoDateTime(new Date()),
      },
      $unset: { failureCode: '' },
    },
    { returnDocument: 'after' },
  )
  if (!queued) {
    const current = await imports.findOne(
      recipeImportOwnerFilter(importId, session.user.id),
    )
    if (
      current &&
      ['queued', 'processing', 'retrying'].includes(current.status)
    ) {
      return Response.json(
        { import: toRecipeImportSummary(current) },
        { status: 202 },
      )
    }
    return notRetryable()
  }

  try {
    await enqueueRecipeImport(db, {
      importId: queued._id,
      userId: queued.userId,
      idempotencyKey: queued.idempotencyKey,
      operation: parsed.data.action,
      jobGeneration,
    })
  } catch {
    await imports.updateOne(
      { _id: queued._id, userId: session.user.id, jobGeneration },
      {
        $set: {
          status: 'failed',
          failureCode: 'IMPORT_QUEUE_UNAVAILABLE',
          updatedAt: isoDateTime(new Date()),
        },
      },
    )
    return queueUnavailable()
  }

  return Response.json(
    { import: toRecipeImportSummary(queued) },
    { status: 202 },
  )
}
