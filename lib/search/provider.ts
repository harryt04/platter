import { z } from 'zod'
import { opaqueCursorSchema } from '@/lib/contracts/ids'
import type { DecimalString } from '@/lib/contracts/ids'
import type { RecipeImageProvenance } from '@/lib/recipes/drafts'

export interface RecipeSearchFilters {
  cuisine?: string
  tags?: string[]
  dietaryLabels?: string[]
  visibility?: 'public' | 'private'
}

export interface RecipeSearchQuery {
  text: string
  /** Required by private-library searches; public discovery leaves it unset. */
  ownerId?: string
  filters?: RecipeSearchFilters
  cursor?: string
  pageSize?: number
}

export interface RecipeSearchResult {
  id: string
  title: string
  source: string
  sourceUrl?: string
  sourceAuthor?: string
  attribution?: string
  score: DecimalString
  visibility: 'public' | 'private'
  typicalPeopleFed?: number
  summary?: string
  cuisine?: string
  tags?: string[]
  dietaryLabels?: string[]
  image?: Pick<RecipeImageProvenance, 'url' | 'altText'>
}

export interface RecipeSearchResponse {
  results: RecipeSearchResult[]
  nextCursor?: string
}

export const recipeSearchResponseSchema = z
  .object({
    results: z.array(
      z
        .object({
          id: z.string().min(1).max(200),
          title: z.string().min(1).max(2000),
          source: z.string().min(1).max(500),
          sourceUrl: z.string().max(2000).optional(),
          sourceAuthor: z.string().max(500).optional(),
          attribution: z.string().max(2000).optional(),
          score: z.string().min(1).max(100),
          visibility: z.enum(['public', 'private']),
          typicalPeopleFed: z.number().int().positive().max(1000).optional(),
          summary: z.string().max(2000).optional(),
          cuisine: z.string().max(100).optional(),
          tags: z.array(z.string().max(100)).max(100).optional(),
          dietaryLabels: z.array(z.string().max(100)).max(100).optional(),
          image: z
            .object({
              url: z.string().max(2000),
              altText: z.string().max(500).optional(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
    nextCursor: opaqueCursorSchema.optional(),
  })
  .strict()

export interface SearchProvider {
  searchRecipes(query: RecipeSearchQuery): Promise<RecipeSearchResponse>
}
