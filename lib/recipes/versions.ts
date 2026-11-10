import type { Collection, Db } from 'mongodb'
import { z } from 'zod'
import {
  recipeVersions,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'

const opaqueId = (label: string) =>
  z
    .string({ error: `Enter a ${label}.` })
    .trim()
    .min(1, `${label} cannot be empty.`)
    .max(200, `${label} must be 200 characters or fewer.`)
    .refine(
      (value) => !/[\u0000-\u001F\u007F]/.test(value),
      `${label} cannot contain control characters.`,
    )

/** The immutable identity stored by active and completed shopping runs. */
export const pinnedRecipeVersionReferenceSchema = z.object({
  recipeId: opaqueId('recipe id'),
  versionId: opaqueId('recipe version id'),
  versionNumber: z
    .number({ error: 'Enter a recipe version number.' })
    .int('Recipe version number must be a whole number.')
    .positive('Recipe version number must be greater than zero.'),
})

export type PinnedRecipeVersionReference = z.infer<
  typeof pinnedRecipeVersionReferenceSchema
>

export type PinnedRecipeVersionResolution = {
  reference: PinnedRecipeVersionReference
  /** Null means the immutable snapshot is unavailable or does not match. */
  version: RecipeVersionDocument | null
}

function versionFilter(versionIds: readonly string[]) {
  return { _id: { $in: versionIds } }
}

/**
 * Resolve immutable run references without consulting the mutable recipe
 * pointer. The returned array keeps run order and intentional duplicates so a
 * caller can attach each resolved version to its original selection.
 */
export async function resolvePinnedRecipeVersions(
  collection: Collection<RecipeVersionDocument>,
  references: readonly PinnedRecipeVersionReference[],
): Promise<PinnedRecipeVersionResolution[]> {
  if (references.length === 0) return []

  const versionIds = [...new Set(references.map(({ versionId }) => versionId))]
  const documents = await recipeVersions(collection)
    .find(versionFilter(versionIds))
    .toArray()
  const documentsById = new Map(
    documents.map((document) => [document._id, document]),
  )

  return references.map((reference) => {
    const document = documentsById.get(reference.versionId)
    const version =
      document &&
      document.recipeId === reference.recipeId &&
      document.versionNumber === reference.versionNumber
        ? document
        : null
    return { reference, version }
  })
}

/** Resolve references for a run while keeping duplicate recipe selections. */
export async function resolveRunRecipeVersions(
  db: Db,
  references: readonly PinnedRecipeVersionReference[],
) {
  return resolvePinnedRecipeVersions(
    db.collection<RecipeVersionDocument>('recipe_versions'),
    references,
  )
}
