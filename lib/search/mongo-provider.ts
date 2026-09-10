import type { Db } from 'mongodb'
import type {
  SearchProvider,
  RecipeSearchQuery,
  RecipeSearchResponse,
} from './provider'
import { decimalString } from '@/lib/contracts/ids'
import { publicRecipeFilter } from '@/lib/recipes/drafts'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

export class MongoRecipeSearchProvider implements SearchProvider {
  constructor(private readonly db: Db) {}

  async searchRecipes(query: RecipeSearchQuery): Promise<RecipeSearchResponse> {
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50)
    const filters = query.filters ?? {}
    const text = query.text.trim()
    const recipeVisibilityFilter =
      filters.visibility === 'private'
        ? query.ownerId
          ? {
              ownerId: query.ownerId,
              status: { $in: ['draft', 'usable'] as const },
              visibility: 'private' as const,
            }
          : { _id: { $in: [] } }
        : publicRecipeFilter()
    const cursor = this.db.collection<RecipeDraftDocument>('recipes').find({
      ...recipeVisibilityFilter,
      ...(text ? { $text: { $search: text } } : {}),
      ...(filters.cuisine ? { cuisine: filters.cuisine } : {}),
      ...(filters.tags?.length ? { tags: { $all: filters.tags } } : {}),
      ...(filters.dietaryLabels?.length
        ? { dietaryLabels: { $all: filters.dietaryLabels } }
        : {}),
    })
    const projectedCursor = cursor.project({
      title: 1,
      sourceName: 1,
      sourceUrl: 1,
      sourceAuthor: 1,
      attribution: 1,
      description: 1,
      typicalPeopleFed: 1,
      cuisine: 1,
      tags: 1,
      dietaryLabels: 1,
      'image.url': 1,
      'image.altText': 1,
      'image.rightsStatus': 1,
      visibility: 1,
      ...(text ? { score: { $meta: 'textScore' as const } } : {}),
    })
    const scoredCursor = text
      ? projectedCursor.sort({ score: { $meta: 'textScore' }, _id: 1 })
      : projectedCursor.sort({ _id: 1 })
    const documents = await scoredCursor.limit(pageSize).toArray()

    return {
      results: documents.map((document) => ({
        id: document._id.toString(),
        title: String(document.title ?? 'Untitled recipe'),
        source: String(document.sourceName ?? 'Platter community'),
        ...(document.sourceUrl === undefined
          ? {}
          : { sourceUrl: String(document.sourceUrl) }),
        ...(document.sourceAuthor === undefined
          ? {}
          : { sourceAuthor: String(document.sourceAuthor) }),
        ...(document.attribution === undefined
          ? {}
          : { attribution: String(document.attribution) }),
        score: decimalString(document.score ?? 0),
        visibility: document.visibility === 'private' ? 'private' : 'public',
        ...(document.typicalPeopleFed === undefined
          ? {}
          : { typicalPeopleFed: document.typicalPeopleFed }),
        ...(document.description === undefined
          ? {}
          : { summary: String(document.description) }),
        ...(document.cuisine === undefined
          ? {}
          : { cuisine: String(document.cuisine) }),
        ...(document.tags === undefined ? {} : { tags: document.tags }),
        ...(document.dietaryLabels === undefined
          ? {}
          : { dietaryLabels: document.dietaryLabels }),
        ...(document.image?.url &&
        ['user-owned', 'licensed', 'permission-granted'].includes(
          document.image.rightsStatus,
        )
          ? {
              image: {
                url: document.image.url,
                ...(document.image.altText === undefined
                  ? {}
                  : { altText: document.image.altText }),
              },
            }
          : {}),
      })),
    }
  }
}
