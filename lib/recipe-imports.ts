import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'

export const recipeImportStatusSchema = z.enum([
  'queued',
  'processing',
  'retrying',
  'failed',
  'preview-ready',
])

export type RecipeImportStatus = z.infer<typeof recipeImportStatusSchema>

export const recipeImportIdSchema = z.string().uuid('Enter a valid import id.')

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
  sourceUrl: string
  status: RecipeImportStatus
  attemptCount: number
  submittedAt: IsoDateTime
  updatedAt: IsoDateTime
  failureCode?: string
}

export type RecipeImportSummary = {
  id: EntityId
  sourceUrl: string
  status: RecipeImportStatus
  attemptCount: number
  submittedAt: IsoDateTime
  updatedAt: IsoDateTime
  failureCode?: string
}

export function recipeImports(collection: Collection<RecipeImportDocument>) {
  return collection
}

export function recipeImportOwnerFilter(importId: string, userId: string) {
  return { _id: importId, userId }
}

export function createRecipeImportDocument(
  userId: string,
  sourceUrl: string,
  now = new Date(),
): RecipeImportDocument {
  const timestamp = isoDateTime(now)
  return {
    _id: crypto.randomUUID(),
    userId,
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
  }
}
