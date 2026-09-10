import type { DecimalString } from '@/lib/contracts/ids'

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
  score: DecimalString
  visibility: 'public' | 'private'
}

export interface RecipeSearchResponse {
  results: RecipeSearchResult[]
  nextCursor?: string
}

export interface SearchProvider {
  searchRecipes(query: RecipeSearchQuery): Promise<RecipeSearchResponse>
}
