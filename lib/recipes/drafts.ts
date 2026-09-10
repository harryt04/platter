import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'

const recipeTitleSchema = z
  .string({ error: 'Enter a recipe title.' })
  .trim()
  .min(1, 'Enter a recipe title.')
  .max(200, 'Recipe titles must be 200 characters or fewer.')

export const createDraftSchema = z.object({ title: recipeTitleSchema })
export const updateDraftSchema = createDraftSchema

export type RecipeDraft = {
  id: EntityId
  ownerId: string
  title: string
  status: 'draft'
  visibility: 'private'
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type RecipeDraftDocument = Omit<RecipeDraft, 'id'> & { _id: string }

export function recipeDrafts(collection: Collection<RecipeDraftDocument>) {
  return collection
}

export function draftOwnerFilter(ownerId: string, draftId?: string) {
  return draftId ? { _id: draftId, ownerId } : { ownerId }
}

export function privateDraftFilter(ownerId: string, draftId?: string) {
  return {
    ...draftOwnerFilter(ownerId, draftId),
    status: 'draft' as const,
    visibility: 'private' as const,
  }
}

export function createDraftDocument(
  ownerId: string,
  title: string,
): RecipeDraftDocument {
  const now = isoDateTime(new Date())
  return {
    _id: crypto.randomUUID(),
    ownerId,
    title,
    status: 'draft',
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
  }
}

export function toRecipeDraft(document: RecipeDraftDocument): RecipeDraft {
  return {
    id: entityId(document._id),
    ownerId: document.ownerId,
    title: document.title,
    status: document.status,
    visibility: document.visibility,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}
