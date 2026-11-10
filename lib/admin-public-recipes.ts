import type { Db, Filter } from 'mongodb'
import { z } from 'zod'
import type {
  RecipeImportImporter,
  RecipeImportRightsStatus,
  RecipeImportSourceAvailability,
} from '@/lib/recipe-imports'
import {
  recipeImportReviewStatusSchema,
  recipeOriginSchema,
  recipeVisibilitySchema,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'

export const adminPublicRecipeSearchFieldSchema = z.enum([
  'all',
  'recipe-id',
  'url',
  'domain',
  'importer',
  'fingerprint',
])

export type AdminPublicRecipeSearchField = z.infer<
  typeof adminPublicRecipeSearchFieldSchema
>

export const adminPublicRecipeSearchParamsSchema = z.object({
  field: adminPublicRecipeSearchFieldSchema.default('all'),
  q: z
    .string()
    .trim()
    .max(2048, 'Search terms must be 2,048 characters or fewer.')
    .default(''),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type AdminPublicRecipeSearchParams = z.infer<
  typeof adminPublicRecipeSearchParamsSchema
>

export type AdminPublicRecipeSummary = {
  id: string
  title: string
  status: RecipeDraftDocument['status']
  visibility: RecipeDraftDocument['visibility']
  origin?: RecipeDraftDocument['origin']
  importReviewStatus?: RecipeDraftDocument['importReviewStatus']
  sourceName?: string
  sourceUrl?: string
  sourceAuthor?: string
  sourceDomain?: string
  importer?: RecipeImportImporter
  contentFingerprint?: string
  rightsStatus?: RecipeImportRightsStatus
  sourceAvailability?: RecipeImportSourceAvailability
  updatedAt: RecipeDraftDocument['updatedAt']
}

/**
 * Keep the administrator finder metadata-only even if a persisted document
 * gains new private fields. This is a response boundary, not just a
 * TypeScript type, because database documents are untrusted runtime data.
 */
export const adminPublicRecipeSummarySchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(2000),
    status: z.enum(['draft', 'usable']),
    visibility: recipeVisibilitySchema,
    origin: recipeOriginSchema.optional(),
    importReviewStatus: recipeImportReviewStatusSchema.optional(),
    sourceName: z.string().max(500).optional(),
    sourceUrl: z.string().max(2048).optional(),
    sourceAuthor: z.string().max(500).optional(),
    sourceDomain: z.string().max(253).optional(),
    importer: z.string().max(100).optional(),
    contentFingerprint: z.string().max(200).optional(),
    rightsStatus: z.string().max(50).optional(),
    sourceAvailability: z.string().max(50).optional(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export const adminPublicRecipeSearchResponseSchema = z
  .object({ recipes: z.array(adminPublicRecipeSummarySchema) })
  .strict()

const publicContentFilter: Filter<RecipeDraftDocument> = {
  status: 'usable',
  visibility: { $in: ['public', 'suppressed'] },
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDomain(value: string) {
  const candidate = value.trim().toLowerCase()
  try {
    const url = new URL(
      candidate.includes('://') ? candidate : `https://${candidate}`,
    )
    return url.hostname.replace(/^www\./i, '')
  } catch {
    return candidate.replace(/^www\./i, '').split('/')[0] ?? candidate
  }
}

function domainFilter(value: string): Filter<RecipeDraftDocument> {
  const domain = normalizeDomain(value)
  const pattern = `(?:^|://)(?:www\\.)?${escapeRegex(domain)}(?:/|$)`
  return {
    $or: [
      { 'importProvenance.sourceDomain': domain },
      { sourceUrl: { $regex: pattern, $options: 'i' } },
      { 'importProvenance.submittedUrl': { $regex: pattern, $options: 'i' } },
      { 'importProvenance.canonicalUrl': { $regex: pattern, $options: 'i' } },
    ],
  }
}

export function buildAdminPublicRecipeFilter({
  field,
  q,
}: Pick<
  AdminPublicRecipeSearchParams,
  'field' | 'q'
>): Filter<RecipeDraftDocument> {
  const value = q.trim()
  if (!value) return publicContentFilter

  const fieldFilter: Filter<RecipeDraftDocument> =
    field === 'recipe-id'
      ? { _id: value }
      : field === 'url'
        ? {
            $or: [
              { sourceUrl: value },
              { 'importProvenance.submittedUrl': value },
              { 'importProvenance.canonicalUrl': value },
            ],
          }
        : field === 'domain'
          ? domainFilter(value)
          : field === 'importer'
            ? { 'importProvenance.importer': value }
            : field === 'fingerprint'
              ? { 'importProvenance.contentFingerprint': value }
              : {
                  $or: [
                    { _id: value },
                    { sourceUrl: value },
                    { 'importProvenance.submittedUrl': value },
                    { 'importProvenance.canonicalUrl': value },
                    { 'importProvenance.sourceDomain': normalizeDomain(value) },
                    { 'importProvenance.importer': value },
                    { 'importProvenance.contentFingerprint': value },
                    domainFilter(value),
                  ],
                }

  return { $and: [publicContentFilter, fieldFilter] }
}

function toAdminPublicRecipeSummary(
  document: RecipeDraftDocument,
): AdminPublicRecipeSummary {
  return {
    id: document._id,
    title: document.title,
    status: document.status,
    visibility: document.visibility,
    ...(document.origin ? { origin: document.origin } : {}),
    ...(document.importReviewStatus
      ? { importReviewStatus: document.importReviewStatus }
      : {}),
    ...(document.sourceName ? { sourceName: document.sourceName } : {}),
    ...(document.sourceUrl || document.importProvenance?.canonicalUrl
      ? {
          sourceUrl:
            document.sourceUrl || document.importProvenance?.canonicalUrl,
        }
      : document.importProvenance?.submittedUrl
        ? { sourceUrl: document.importProvenance.submittedUrl }
        : {}),
    ...(document.sourceAuthor ? { sourceAuthor: document.sourceAuthor } : {}),
    ...(document.importProvenance?.sourceDomain
      ? { sourceDomain: document.importProvenance.sourceDomain }
      : {}),
    ...(document.importProvenance?.importer
      ? { importer: document.importProvenance.importer }
      : {}),
    ...(document.importProvenance?.contentFingerprint
      ? { contentFingerprint: document.importProvenance.contentFingerprint }
      : {}),
    ...(document.importProvenance?.rightsStatus
      ? { rightsStatus: document.importProvenance.rightsStatus }
      : {}),
    ...(document.importProvenance?.sourceAvailability
      ? { sourceAvailability: document.importProvenance.sourceAvailability }
      : {}),
    updatedAt: document.updatedAt,
  }
}

export async function findAdminPublicRecipes(
  db: Db,
  params: Pick<AdminPublicRecipeSearchParams, 'field' | 'q' | 'limit'>,
) {
  const documents = await db
    .collection<RecipeDraftDocument>('recipes')
    .find(buildAdminPublicRecipeFilter(params))
    .project({
      _id: 1,
      title: 1,
      status: 1,
      visibility: 1,
      origin: 1,
      importReviewStatus: 1,
      sourceName: 1,
      sourceUrl: 1,
      sourceAuthor: 1,
      'importProvenance.submittedUrl': 1,
      'importProvenance.canonicalUrl': 1,
      'importProvenance.sourceDomain': 1,
      'importProvenance.importer': 1,
      'importProvenance.contentFingerprint': 1,
      'importProvenance.rightsStatus': 1,
      'importProvenance.sourceAvailability': 1,
      updatedAt: 1,
    })
    .sort({ updatedAt: -1, _id: 1 })
    .limit(params.limit)
    .toArray()

  const recipes = documents.map((document) =>
    toAdminPublicRecipeSummary(document as RecipeDraftDocument),
  )

  adminPublicRecipeSearchResponseSchema.parse({ recipes })
  return recipes
}
