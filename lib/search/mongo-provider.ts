import type { Db } from 'mongodb'
import type {
  SearchProvider,
  RecipeSearchQuery,
  RecipeSearchResponse,
} from './provider'

export class MongoRecipeSearchProvider implements SearchProvider {
  constructor(private readonly db: Db) {}

  async searchRecipes(query: RecipeSearchQuery): Promise<RecipeSearchResponse> {
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50)
    const filters = query.filters ?? {}
    const documents = await this.db
      .collection('recipes')
      .find({
        ...(query.text ? { $text: { $search: query.text } } : {}),
        ...(filters.visibility
          ? { visibility: filters.visibility }
          : { visibility: 'public' }),
        ...(filters.cuisine ? { cuisine: filters.cuisine } : {}),
        ...(filters.tags?.length ? { tags: { $all: filters.tags } } : {}),
        ...(filters.dietaryLabels?.length
          ? { dietaryLabels: { $all: filters.dietaryLabels } }
          : {}),
      })
      .project({
        title: 1,
        source: 1,
        visibility: 1,
        score: { $meta: 'textScore' },
      })
      .sort({ score: { $meta: 'textScore' }, _id: 1 })
      .limit(pageSize)
      .toArray()

    return {
      results: documents.map((document) => ({
        id: document._id.toString(),
        title: String(document.title ?? 'Untitled recipe'),
        source: String(document.source ?? 'Platter'),
        score: String(document.score ?? 0) as never,
        visibility: document.visibility === 'private' ? 'private' : 'public',
      })),
    }
  }
}
