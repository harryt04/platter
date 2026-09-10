import { z } from 'zod'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { decodeRecipeSearchCursor } from '@/lib/search/mongo-provider'
import { createRecipeSearchProvider } from '@/lib/search/default-provider'

const searchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search terms must be 100 characters or fewer.')
    .default(''),
  cuisine: z.string().trim().max(100).optional(),
  tags: z.string().trim().max(500).optional(),
  dietaryLabels: z.string().trim().max(500).optional(),
  cursor: z.string().max(500).optional(),
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

  const db = await getConnectedDatabase()
  const recipes = await createRecipeSearchProvider(db).searchRecipes({
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

  return Response.json(recipes)
}
