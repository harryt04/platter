import type { Db } from 'mongodb'
import type { RecipeImportDocument } from '@/lib/recipe-imports'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

export type ExistingPublicImportedRecipe = {
  id: string
  title: string
  sourceUrl?: string
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
    { projection: { _id: 1, title: 1, sourceUrl: 1 } },
  )

  if (!recipe) return null
  return {
    id: recipe._id,
    title: recipe.title,
    ...(recipe.sourceUrl ? { sourceUrl: recipe.sourceUrl } : {}),
  }
}
