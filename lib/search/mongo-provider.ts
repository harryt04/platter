import type { Db, Document } from 'mongodb'
import type {
  SearchProvider,
  RecipeSearchQuery,
  RecipeSearchResponse,
} from './provider'
import { decimalString } from '@/lib/contracts/ids'
import { publicRecipeFilter } from '@/lib/recipes/drafts'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

type RecipeSearchAggregationDocument = Pick<
  RecipeDraftDocument,
  | '_id'
  | 'title'
  | 'sourceName'
  | 'sourceUrl'
  | 'sourceAuthor'
  | 'attribution'
  | 'description'
  | 'typicalPeopleFed'
  | 'cuisine'
  | 'tags'
  | 'dietaryLabels'
  | 'image'
  | 'visibility'
> & {
  rankScore?: number
}

const completenessSignals = [
  { $size: { $ifNull: ['$ingredients', []] } },
  { $size: { $ifNull: ['$instructions', []] } },
  { $ifNull: ['$typicalPeopleFed', 0] },
  { $strLenCP: { $ifNull: ['$sourceName', ''] } },
  { $strLenCP: { $ifNull: ['$description', ''] } },
  { $strLenCP: { $ifNull: ['$sourceUrl', ''] } },
  { $strLenCP: { $ifNull: ['$attribution', ''] } },
  { $strLenCP: { $ifNull: ['$image.url', ''] } },
] as const

function presentSignal(expression: (typeof completenessSignals)[number]) {
  return { $cond: [{ $gt: [expression, 0] }, 1, 0] }
}

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
    const filter = {
      ...recipeVisibilityFilter,
      ...(text ? { $text: { $search: text } } : {}),
      ...(filters.cuisine ? { cuisine: filters.cuisine } : {}),
      ...(filters.tags?.length ? { tags: { $all: filters.tags } } : {}),
      ...(filters.dietaryLabels?.length
        ? { dietaryLabels: { $all: filters.dietaryLabels } }
        : {}),
    }
    // Keep relevance dominant while making complete, useful recipes win
    // ties. Save engagement is deliberately capped so popularity cannot bury
    // source identity or turn discovery into a popularity-only feed.
    const documents = await this.db
      .collection<RecipeDraftDocument>('recipes')
      .aggregate<RecipeSearchAggregationDocument>([
        { $match: filter },
        {
          $project: {
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
            ingredients: 1,
            instructions: 1,
            'image.url': 1,
            'image.altText': 1,
            'image.rightsStatus': 1,
            visibility: 1,
            ...(text ? { textScore: { $meta: 'textScore' as const } } : {}),
          },
        },
        {
          $set: {
            completenessScore: {
              $add: completenessSignals.map(presentSignal),
            },
          },
        },
        {
          $lookup: {
            from: 'recipe_saves',
            localField: '_id',
            foreignField: 'recipeId',
            as: 'engagementSaves',
          },
        },
        {
          $set: {
            rankScore: {
              $add: [
                text ? { $ifNull: ['$textScore', 0] } : 0,
                { $multiply: ['$completenessScore', 0.25] },
                {
                  $multiply: [
                    { $min: [{ $size: '$engagementSaves' }, 10] },
                    0.05,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { rankScore: -1, _id: 1 } },
        { $limit: pageSize },
        {
          $project: {
            engagementSaves: 0,
            textScore: 0,
            completenessScore: 0,
          },
        },
      ] as Document[])
      .toArray()

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
        score: decimalString(document.rankScore ?? 0),
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
