import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  createComplaintDocument,
  createComplaintSchema,
  toComplaintReceipt,
  type ComplaintDocument,
} from '@/lib/complaints'
import {
  publicRecipeFilter,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'
import { checkRateLimit } from '@/lib/security/rate-limit'

const COMPLAINT_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }

function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const address =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'anonymous'
  return address.slice(0, 128)
}

function rateLimited(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({
      type: 'https://platter.dev/problems/rate-limited',
      title: 'Too many reports',
      status: 429,
      detail: 'Wait before submitting another public-content report.',
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

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid report',
    status: 400,
    detail: 'Send a JSON object containing the public content to review.',
    code: 'INVALID_JSON',
  })
}

function validationFailed(fields: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the report details',
    status: 422,
    detail: 'Fix the highlighted report details and try again.',
    code: 'VALIDATION_FAILED',
    fields,
  })
}

function recipeNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-not-found',
    title: 'Recipe not found',
    status: 404,
    detail: 'That public recipe is not available to report.',
    code: 'RECIPE_NOT_FOUND',
  })
}

export async function POST(request: Request) {
  const limit = checkRateLimit(
    `public-complaint:${clientKey(request)}`,
    COMPLAINT_RATE_LIMIT,
  )
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = createComplaintSchema.safeParse(body)
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string[]>>(
      (result, issue) => {
        const field = issue.path[0]?.toString() ?? 'report'
        result[field] = [...(result[field] ?? []), issue.message]
        return result
      },
      {},
    )
    return validationFailed(fields)
  }

  const db = await getConnectedDatabase()
  if (parsed.data.recipeId) {
    const recipe = await db
      .collection<RecipeDraftDocument>('recipes')
      .findOne(publicRecipeFilter(parsed.data.recipeId), {
        projection: { _id: 1 },
      })
    if (!recipe) return recipeNotFound()
  }

  const document = createComplaintDocument(parsed.data)
  await db.collection<ComplaintDocument>('complaints').insertOne(document)

  return Response.json(
    { complaint: toComplaintReceipt(document) },
    { status: 201 },
  )
}
