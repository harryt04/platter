import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import type { RecipeImportCandidate } from '@/lib/recipe-import-schema-org'

export const recipeImportAcquisitionMethodSchema = z.enum(['server-fetch'])
export const recipeImportImporterSchema = z.enum(['schema-org-json-ld'])
export const recipeImportRightsStatusSchema = z.enum([
  'unknown',
  'licensed',
  'permission-granted',
])

export type RecipeImportAcquisitionMethod = z.infer<
  typeof recipeImportAcquisitionMethodSchema
>
export type RecipeImportImporter = z.infer<typeof recipeImportImporterSchema>
export type RecipeImportRightsStatus = z.infer<
  typeof recipeImportRightsStatusSchema
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
  failureCode?: string
  preview?: RecipeImportCandidate
  savedRecipeId?: EntityId
}

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
    ...(document.failureCode ? { failureCode: document.failureCode } : {}),
    ...(document.preview ? { preview: document.preview } : {}),
    ...(document.savedRecipeId
      ? { savedRecipeId: entityId(document.savedRecipeId) }
      : {}),
  }
}
