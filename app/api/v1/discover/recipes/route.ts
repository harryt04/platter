import { z } from 'zod'
import { opaqueCursorSchema } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { decodeRecipeSearchCursor } from '@/lib/search/mongo-provider'
import { createRecipeSearchProvider } from '@/lib/search/default-provider'
import {
  recipeSearchResponseSchema,
  type RecipeSearchResponse,
} from '@/lib/search/provider'
import {
  checkRateLimit,
  rateLimitProblemResponse,
} from '@/lib/security/rate-limit'

const SEARCH_RATE_LIMIT = { limit: 120, windowMs: 60 * 1000 }

function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  return (
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'anonymous'
  ).slice(0, 128)
}

const searchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search terms must be 100 characters or fewer.')
    .default(''),
  cuisine: z.string().trim().max(100).optional(),
  tags: z.string().trim().max(500).optional(),
  dietaryLabels: z.string().trim().max(500).optional(),
  cursor: opaqueCursorSchema.optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the search',
    status: 422,
    detail: 'Use a valid search and pagination cursor.',
    code: 'VALIDATION_FAILED',
  })
}

export async function GET(request: Request) {
  const limit = checkRateLimit(
    `public-search:${clientKey(request)}`,
    SEARCH_RATE_LIMIT,
  )
  if (!limit.allowed) {
    return rateLimitProblemResponse({
      title: 'Search limit reached',
      detail: 'Wait before searching public recipes again.',
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const url = new URL(request.url)
  const parsed = searchParamsSchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    cuisine: url.searchParams.get('cuisine') ?? undefined,
    tags: url.searchParams.get('tags') ?? undefined,
    dietaryLabels: url.searchParams.get('dietaryLabels') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  })
  if (
    !parsed.success ||
    (parsed.data.cursor && !decodeRecipeSearchCursor(parsed.data.cursor))
  )
    return validationFailed()

  let recipes: RecipeSearchResponse
  try {
    const db = await getConnectedDatabase()
    recipes = await createRecipeSearchProvider(db).searchRecipes({
      text: parsed.data.q,
      cursor: parsed.data.cursor,
      pageSize: parsed.data.pageSize,
      filters: {
        ...(parsed.data.cuisine ? { cuisine: parsed.data.cuisine } : {}),
        ...(parsed.data.tags
          ? { tags: parsed.data.tags.split(',').map((tag) => tag.trim()) }
          : {}),
        ...(parsed.data.dietaryLabels
          ? {
              dietaryLabels: parsed.data.dietaryLabels
                .split(',')
                .map((label) => label.trim()),
            }
          : {}),
      },
    })
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/search-unavailable',
      title: 'Search temporarily unavailable',
      status: 503,
      detail:
        'Public recipe discovery is temporarily unavailable. Try again shortly.',
      code: 'SEARCH_UNAVAILABLE',
    })
  }

  const response = recipeSearchResponseSchema.safeParse(recipes)
  if (!response.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/search-response-invalid',
      title: 'Search unavailable',
      status: 502,
      detail: 'The public recipe search returned an invalid response.',
      code: 'SEARCH_RESPONSE_INVALID',
    })
  }

  return Response.json(response.data)
}
