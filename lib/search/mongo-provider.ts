import type { Db, Document } from 'mongodb'
import type {
  SearchProvider,
  RecipeSearchQuery,
  RecipeSearchResponse,
} from './provider'
import { decimalString } from '@/lib/contracts/ids'
import {
  isRecipeImagePubliclyPermitted,
  publicRecipeFilter,
} from '@/lib/recipes/drafts'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'
import { z } from 'zod'

const recipeSearchCursorSchema = z.object({
  rankScore: z.number().finite(),
  id: z.string().min(1).max(200),
})

export function encodeRecipeSearchCursor(cursor: {
  rankScore: number
  id: string
}) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodeRecipeSearchCursor(value: string) {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const parsed = recipeSearchCursorSchema.safeParse(decoded)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

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
  | 'importProvenance'
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
    const cursor = query.cursor ? decodeRecipeSearchCursor(query.cursor) : null
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
            importProvenance: 1,
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
        ...(cursor
          ? [
              {
                $match: {
                  $or: [
                    { rankScore: { $lt: cursor.rankScore } },
                    {
                      rankScore: cursor.rankScore,
                      _id: { $gt: cursor.id },
                    },
                  ],
                },
              },
            ]
          : []),
        { $sort: { rankScore: -1, _id: 1 } },
        { $limit: pageSize + 1 },
        {
          $project: {
            engagementSaves: 0,
            textScore: 0,
            completenessScore: 0,
          },
        },
      ] as Document[])
      .toArray()

    const hasNextPage = documents.length > pageSize
    const results = hasNextPage ? documents.slice(0, pageSize) : documents
    const lastResult = results.at(-1)

    return {
      results: results.map((document) => ({
        id: document._id.toString(),
        title: String(document.title ?? 'Untitled recipe'),
        source: String(
          document.sourceName ||
            document.importProvenance?.sourceDomain ||
            'Platter community',
        ),
        ...(document.sourceUrl || document.importProvenance?.canonicalUrl
          ? {
              sourceUrl: String(
                document.sourceUrl || document.importProvenance?.canonicalUrl,
              ),
            }
          : document.importProvenance?.submittedUrl
            ? { sourceUrl: String(document.importProvenance.submittedUrl) }
            : {}),
        ...(document.sourceAuthor || document.importProvenance?.sourceAuthor
          ? {
              sourceAuthor: String(
                document.sourceAuthor ||
                  document.importProvenance?.sourceAuthor,
              ),
            }
          : {}),
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
        isRecipeImagePubliclyPermitted(document.image)
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
      ...(hasNextPage && lastResult
        ? {
            nextCursor: encodeRecipeSearchCursor({
              rankScore: lastResult.rankScore ?? 0,
              id: lastResult._id,
            }),
          }
        : {}),
    }
  }
}
