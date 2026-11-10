import type { Collection } from 'mongodb'
import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { recipeIdSchema } from '@/lib/recipes/drafts'

export type RecipeSaveDocument = {
  _id: string
  userId: string
  recipeId: string
  createdAt: IsoDateTime
}

/** Runtime boundary for the minimal public recipe target used by save routes. */
export const publicRecipeSaveTargetSchema = z
  .object({
    _id: recipeIdSchema,
    status: z.literal('usable'),
    visibility: z.literal('public'),
    origin: z.enum(['authored', 'imported']).optional(),
    importReviewStatus: z
      .enum(['not-required', 'pending', 'approved', 'rejected'])
      .optional(),
  })
  .refine(
    (recipe) =>
      recipe.origin !== 'imported' || recipe.importReviewStatus === 'approved',
    'Imported recipes must be approved before they can be saved.',
  )

/** Runtime boundary for save and remove responses. */
export const recipeSaveResponseSchema = z.strictObject({
  recipeId: recipeIdSchema,
  saved: z.boolean(),
})

export function recipeSaves(collection: Collection<RecipeSaveDocument>) {
  return collection
}

export function createRecipeSaveDocument(
  userId: string,
  recipeId: string,
  now = new Date(),
): RecipeSaveDocument {
  return {
    _id: crypto.randomUUID(),
    userId,
    recipeId,
    createdAt: isoDateTime(now),
  }
}
