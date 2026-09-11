import type { Db, Filter } from 'mongodb'
import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

const cleanText = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()

const targetTextSchema = z
  .string({ error: 'Enter a suppression target.' })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, 'Enter a suppression target.')
      .max(2048, 'Suppression targets must be 2,048 characters or fewer.')
      .refine(
        (value) => !/[\u0000-\u001F\u007F]/.test(value),
        'Suppression targets cannot contain control characters.',
      ),
  )

const sourceUrlTargetSchema = targetTextSchema.refine((value) => {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}, 'Source URL must be an HTTP or HTTPS URL without credentials.')

export const publicContentSuppressionTargetTypeSchema = z.enum([
  'recipe',
  'source-url',
  'domain',
])

export type PublicContentSuppressionTargetType = z.infer<
  typeof publicContentSuppressionTargetTypeSchema
>

export const createPublicContentSuppressionSchema = z.object({
  targetType: publicContentSuppressionTargetTypeSchema,
  target: targetTextSchema,
  reason: z
    .string({ error: 'Enter a suppression reason.' })
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(1, 'Enter a suppression reason.')
        .max(2000, 'Suppression reasons must be 2,000 characters or fewer.'),
    ),
})

export type CreatePublicContentSuppression = z.infer<
  typeof createPublicContentSuppressionSchema
>

export type PublicContentSuppressionStatus = 'active' | 'restored'

export type PublicContentSuppressionDocument = {
  _id: string
  targetType: PublicContentSuppressionTargetType
  target: string
  reason: string
  status: PublicContentSuppressionStatus
  createdBy: string
  createdAt: IsoDateTime
  auditId: string
  restoredBy?: string
  restoredAt?: IsoDateTime
  restorationAuditId?: string
}

export type PublicContentSuppressionAuditDocument = {
  _id: string
  suppressionId: string
  action: 'suppressed' | 'restored'
  targetType: PublicContentSuppressionTargetType
  target: string
  reason?: string
  actorId: string
  occurredAt: IsoDateTime
}

export function normalizePublicContentSuppressionTarget(
  targetType: PublicContentSuppressionTargetType,
  target: string,
) {
  const trimmed = target.trim()
  if (targetType === 'recipe') return trimmed
  if (targetType === 'source-url') {
    const url = new URL(trimmed)
    url.hash = ''
    return url.toString()
  }

  const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  if (url.username || url.password || url.pathname !== '/' || url.search) {
    throw new Error('Domain targets must contain only a hostname.')
  }
  return url.hostname.replace(/^www\./i, '').toLowerCase()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build the recipe-side match for an active suppression. Keeping this
 * alongside target normalization makes URL and domain takedowns apply to all
 * retained provenance fields without exposing those fields publicly.
 */
export function publicContentSuppressionRecipeFilter(
  suppression: Pick<PublicContentSuppressionDocument, 'targetType' | 'target'>,
): Filter<RecipeDraftDocument> {
  if (suppression.targetType === 'recipe') {
    return { _id: suppression.target }
  }

  if (suppression.targetType === 'source-url') {
    const exactOrFragmentUrl = {
      $regex: `^${escapeRegex(suppression.target)}(?:#.*)?$`,
    }
    return {
      $or: [
        { sourceUrl: exactOrFragmentUrl },
        { 'importProvenance.submittedUrl': exactOrFragmentUrl },
        { 'importProvenance.canonicalUrl': exactOrFragmentUrl },
      ],
    }
  }

  const domainPattern = `^https?://(?:www\\.)?${escapeRegex(
    suppression.target,
  )}(?::\\d+)?(?:/|$)`
  return {
    $or: [
      { 'importProvenance.sourceDomain': suppression.target },
      { sourceUrl: { $regex: domainPattern, $options: 'i' } },
      {
        'importProvenance.submittedUrl': {
          $regex: domainPattern,
          $options: 'i',
        },
      },
      {
        'importProvenance.canonicalUrl': {
          $regex: domainPattern,
          $options: 'i',
        },
      },
    ],
  }
}

export function validatePublicContentSuppressionInput(
  input: CreatePublicContentSuppression,
) {
  if (input.targetType === 'source-url') {
    return sourceUrlTargetSchema.safeParse(input.target).success
  }
  if (input.targetType === 'domain') {
    try {
      normalizePublicContentSuppressionTarget(input.targetType, input.target)
      return true
    } catch {
      return false
    }
  }
  return true
}

export function createPublicContentSuppression(
  input: CreatePublicContentSuppression,
  actorId: string,
  now = new Date(),
) {
  const createdAt = isoDateTime(now)
  const suppressionId = crypto.randomUUID()
  const auditId = crypto.randomUUID()
  const target = normalizePublicContentSuppressionTarget(
    input.targetType,
    input.target,
  )
  const suppression: PublicContentSuppressionDocument = {
    _id: suppressionId,
    targetType: input.targetType,
    target,
    reason: input.reason,
    status: 'active',
    createdBy: actorId,
    createdAt,
    auditId,
  }
  const audit: PublicContentSuppressionAuditDocument = {
    _id: auditId,
    suppressionId,
    action: 'suppressed',
    targetType: input.targetType,
    target,
    reason: input.reason,
    actorId,
    occurredAt: createdAt,
  }
  return { suppression, audit }
}

export function toPublicContentSuppressionSummary(
  document: PublicContentSuppressionDocument,
) {
  return {
    id: document._id,
    targetType: document.targetType,
    target: document.target,
    reason: document.reason,
    status: document.status,
    createdBy: document.createdBy,
    createdAt: document.createdAt,
    auditId: document.auditId,
    ...(document.restoredBy ? { restoredBy: document.restoredBy } : {}),
    ...(document.restoredAt ? { restoredAt: document.restoredAt } : {}),
    ...(document.restorationAuditId
      ? { restorationAuditId: document.restorationAuditId }
      : {}),
  }
}

export async function findActivePublicContentSuppression(
  db: Db,
  targetType: PublicContentSuppressionTargetType,
  target: string,
) {
  return db
    .collection<PublicContentSuppressionDocument>('public_content_suppressions')
    .findOne({ targetType, target, status: 'active' })
}
