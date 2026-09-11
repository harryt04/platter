import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  opaqueIdSchema,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import {
  recipeIngredientSchema,
  recipeInstructionSchema,
} from '@/lib/recipes/drafts'
import type { RecipeImportCandidate } from '@/lib/recipe-import-schema-org'

export const recipeImportAcquisitionMethodSchema = z.enum(['server-fetch'])
export const recipeImportImporterSchema = z.enum([
  'schema-org-json-ld',
  'generic-html',
])
export const recipeImportRightsStatusSchema = z.enum([
  'unknown',
  'licensed',
  'permission-granted',
])
export const recipeImportSourceAvailabilitySchema = z.enum([
  'available',
  'unavailable',
])

export type RecipeImportAcquisitionMethod = z.infer<
  typeof recipeImportAcquisitionMethodSchema
>
export type RecipeImportImporter = z.infer<typeof recipeImportImporterSchema>
export type RecipeImportRightsStatus = z.infer<
  typeof recipeImportRightsStatusSchema
>
export type RecipeImportSourceAvailability = z.infer<
  typeof recipeImportSourceAvailabilitySchema
>

export const recipeImportStatusSchema = z.enum([
  'queued',
  'processing',
  'retrying',
  'failed',
  'preview-ready',
])

export type RecipeImportStatus = z.infer<typeof recipeImportStatusSchema>

export const recipeImportIdSchema = z.string().uuid('Enter a valid import id.')

/**
 * Idempotency keys are opaque request identifiers, not user content. Keep
 * them bounded and printable so they are safe to persist and use in job
 * uniqueness queries.
 */
export const recipeImportIdempotencyKeySchema = z
  .string({ error: 'Send an Idempotency-Key header.' })
  .trim()
  .min(1, 'Send an Idempotency-Key header.')
  .max(128, 'Idempotency keys must be 128 characters or fewer.')
  .regex(/^[\x21-\x7e]+$/, 'Idempotency keys must use printable characters.')

export const recipeImportUrlSchema = z
  .string({ error: 'Enter a recipe URL.' })
  .trim()
  .max(2048, 'Recipe URLs must be 2,048 characters or fewer.')
  .url('Enter a valid recipe URL.')
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://'),
    'Recipe URL must use HTTP or HTTPS.',
  )
  .refine((value) => {
    const url = new URL(value)
    return !url.username && !url.password
  }, 'Recipe URL cannot include sign-in credentials.')

export const submitRecipeImportSchema = z.object({
  sourceUrl: recipeImportUrlSchema,
})

export type RecipeImportDocument = {
  _id: string
  userId: string
  idempotencyKey: string
  sourceUrl: string
  status: RecipeImportStatus
  attemptCount: number
  jobGeneration?: string
  submittedAt: IsoDateTime
  updatedAt: IsoDateTime
  canonicalUrl?: string
  sourceDomain?: string
  sourceTitle?: string
  sourceAuthor?: string
  importer?: RecipeImportImporter
  acquiredAt?: IsoDateTime
  acquisitionMethod?: RecipeImportAcquisitionMethod
  contentFingerprint?: string
  rightsStatus?: RecipeImportRightsStatus
  sourceAvailability?: RecipeImportSourceAvailability
  sourceCheckedAt?: IsoDateTime
  failureCode?: string
  preview?: RecipeImportCandidate
  savedRecipeId?: string
}

export type RecipeImportSummary = {
  id: EntityId
  sourceUrl: string
  status: RecipeImportStatus
  attemptCount: number
  submittedAt: IsoDateTime
  updatedAt: IsoDateTime
  sourceAvailability?: RecipeImportSourceAvailability
  sourceCheckedAt?: IsoDateTime
  failureCode?: string
  preview?: RecipeImportCandidate
  savedRecipeId?: EntityId
}

const importedTextSchema = z.string().max(2000)

/** Validate normalized importer output before it crosses an API boundary. */
export const recipeImportCandidateSchema = z.strictObject({
  title: z.string().max(200).optional(),
  typicalPeopleFed: z.number().int().positive().max(1000).optional(),
  ingredients: z.array(recipeIngredientSchema).max(100),
  instructions: z.array(recipeInstructionSchema).max(100),
  prepTimeMinutes: z.number().int().nonnegative().max(10080).optional(),
  cookingTimeMinutes: z.number().int().nonnegative().max(10080).optional(),
  totalTimeMinutes: z.number().int().nonnegative().max(10080).optional(),
  cuisine: importedTextSchema.optional(),
  mealType: importedTextSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  dietaryLabels: z.array(z.string().max(50)).max(20).optional(),
  sourceName: importedTextSchema.optional(),
  sourceUrl: recipeImportUrlSchema,
  sourceAuthor: importedTextSchema.optional(),
  attribution: z.string().max(1000).optional(),
  warnings: z.array(importedTextSchema).max(50),
})

export const recipeImportSummarySchema = z.strictObject({
  id: opaqueIdSchema,
  sourceUrl: recipeImportUrlSchema,
  status: recipeImportStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  submittedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sourceAvailability: recipeImportSourceAvailabilitySchema.optional(),
  sourceCheckedAt: z.string().datetime().optional(),
  failureCode: z.string().max(200).optional(),
  preview: recipeImportCandidateSchema.optional(),
  savedRecipeId: opaqueIdSchema.optional(),
})

/** Shared response boundary for import queue mutations. */
export const recipeImportSummaryResponseSchema = z.strictObject({
  import: recipeImportSummarySchema,
})

export function recipeImports(collection: Collection<RecipeImportDocument>) {
  return collection
}

export function recipeImportOwnerFilter(importId: string, userId: string) {
  return { _id: importId, userId }
}

export function createRecipeImportDocument(
  userId: string,
  idempotencyKey: string,
  sourceUrl: string,
  now = new Date(),
): RecipeImportDocument {
  const timestamp = isoDateTime(now)
  return {
    _id: crypto.randomUUID(),
    userId,
    idempotencyKey,
    sourceUrl,
    status: 'queued',
    attemptCount: 0,
    jobGeneration: crypto.randomUUID(),
    submittedAt: timestamp,
    updatedAt: timestamp,
  }
}

export function toRecipeImportSummary(
  document: RecipeImportDocument,
): RecipeImportSummary {
  return {
    id: entityId(document._id),
    sourceUrl: document.sourceUrl,
    status: document.status,
    attemptCount: document.attemptCount,
    submittedAt: document.submittedAt,
    updatedAt: document.updatedAt,
    ...(document.sourceAvailability
      ? { sourceAvailability: document.sourceAvailability }
      : {}),
    ...(document.sourceCheckedAt
      ? { sourceCheckedAt: document.sourceCheckedAt }
      : {}),
    ...(document.failureCode ? { failureCode: document.failureCode } : {}),
    ...(document.preview ? { preview: document.preview } : {}),
    ...(document.savedRecipeId
      ? { savedRecipeId: entityId(document.savedRecipeId) }
      : {}),
  }
}
