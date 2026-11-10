import type { Db } from 'mongodb'
import type { RecipeImportDocument } from '@/lib/recipe-imports'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

export type ExistingPublicImportedRecipe = {
  id: string
  title: string
  sourceUrl?: string
  canonicalUrl?: string
  contentFingerprint?: string
  versionId?: string
  versionNumber?: number
}

/**
 * Finds an approved public import that represents the same fetched source.
 * Canonical URLs catch repeated submissions while fingerprints catch sources
 * that publish the same content at more than one URL.
 */
export async function findExistingPublicImportedRecipe(
  db: Db,
  source: Pick<RecipeImportDocument, 'canonicalUrl' | 'contentFingerprint'>,
): Promise<ExistingPublicImportedRecipe | null> {
  const identityFilters = [
    ...(source.canonicalUrl
      ? [{ 'importProvenance.canonicalUrl': source.canonicalUrl }]
      : []),
    ...(source.contentFingerprint
      ? [
          {
            'importProvenance.contentFingerprint': source.contentFingerprint,
          },
        ]
      : []),
  ]
  if (identityFilters.length === 0) return null

  const recipe = await db.collection<RecipeDraftDocument>('recipes').findOne(
    {
      status: 'usable',
      visibility: 'public',
      origin: 'imported',
      importReviewStatus: 'approved',
      $or: identityFilters,
    },
    {
      projection: {
        _id: 1,
        title: 1,
        sourceUrl: 1,
        recipeId: 1,
        versionId: 1,
        versionNumber: 1,
        'importProvenance.canonicalUrl': 1,
        'importProvenance.contentFingerprint': 1,
      },
    },
  )

  if (!recipe) return null
  return {
    id: recipe._id,
    title: recipe.title,
    ...(recipe.sourceUrl ? { sourceUrl: recipe.sourceUrl } : {}),
    ...(recipe.importProvenance?.canonicalUrl
      ? { canonicalUrl: recipe.importProvenance.canonicalUrl }
      : {}),
    ...(recipe.importProvenance?.contentFingerprint
      ? { contentFingerprint: recipe.importProvenance.contentFingerprint }
      : {}),
    ...(recipe.versionId ? { versionId: recipe.versionId } : {}),
    ...(recipe.versionNumber ? { versionNumber: recipe.versionNumber } : {}),
  }
}

export function isExactImportedContent(
  source: Pick<RecipeImportDocument, 'canonicalUrl' | 'contentFingerprint'>,
  existing: ExistingPublicImportedRecipe,
) {
  if (
    source.contentFingerprint &&
    existing.contentFingerprint &&
    source.contentFingerprint === existing.contentFingerprint
  ) {
    return true
  }

  return Boolean(
    source.canonicalUrl &&
    existing.canonicalUrl &&
    source.canonicalUrl === existing.canonicalUrl &&
    !source.contentFingerprint,
  )
}

export function isRelatedImportedContent(
  source: Pick<RecipeImportDocument, 'canonicalUrl' | 'contentFingerprint'>,
  existing: ExistingPublicImportedRecipe,
) {
  return Boolean(
    source.canonicalUrl &&
    source.contentFingerprint &&
    existing.canonicalUrl === source.canonicalUrl &&
    existing.contentFingerprint &&
    existing.contentFingerprint !== source.contentFingerprint,
  )
}
