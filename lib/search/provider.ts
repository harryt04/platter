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

export interface SearchProvider {
  searchRecipes(query: RecipeSearchQuery): Promise<RecipeSearchResponse>
}
