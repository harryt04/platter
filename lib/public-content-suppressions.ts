import type { ClientSession, Db, Filter } from 'mongodb'
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

const fingerprintTargetSchema = targetTextSchema.refine(
  (value) => /^sha256:[a-f0-9]{64}$/i.test(value),
  'Content fingerprints must be a SHA-256 fingerprint.',
)

export const publicContentSuppressionTargetTypeSchema = z.enum([
  'recipe',
  'source-url',
  'fingerprint',
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

export const suppressionIdSchema = z.string().uuid()

export type PublicContentSuppressionSummary = {
  id: string
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
  if (targetType === 'fingerprint') return trimmed.toLowerCase()

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

  if (suppression.targetType === 'fingerprint') {
    return { 'importProvenance.contentFingerprint': suppression.target }
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
  if (input.targetType === 'fingerprint') {
    return fingerprintTargetSchema.safeParse(input.target).success
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

export function restorePublicContentSuppression(
  document: PublicContentSuppressionDocument,
  actorId: string,
  now = new Date(),
) {
  const restoredAt = isoDateTime(now)
  const restorationAuditId = crypto.randomUUID()
  const suppression: PublicContentSuppressionDocument = {
    ...document,
    status: 'restored',
    restoredBy: actorId,
    restoredAt,
    restorationAuditId,
  }
  const audit: PublicContentSuppressionAuditDocument = {
    _id: restorationAuditId,
    suppressionId: document._id,
    action: 'restored',
    targetType: document.targetType,
    target: document.target,
    reason: document.reason,
    actorId,
    occurredAt: restoredAt,
  }
  return { suppression, audit }
}

export type PublicContentSuppressionImportIdentity = {
  recipeId?: string
  submittedUrl?: string
  canonicalUrl?: string
  sourceDomain?: string
  contentFingerprint?: string
}

function normalizedSourceUrl(value: string) {
  try {
    return normalizePublicContentSuppressionTarget('source-url', value)
  } catch {
    return null
  }
}

/**
 * Resolve all active suppression keys that can identify an imported source.
 * Import workers and preview saves use the same lookup so a suppression cannot
 * be bypassed by changing the submitted URL, importer, or review timing.
 */
export async function findActivePublicContentSuppressionForImport(
  db: Db,
  identity: PublicContentSuppressionImportIdentity,
  session?: ClientSession,
) {
  const targets: Array<{
    targetType: PublicContentSuppressionTargetType
    target: string
  }> = []

  if (identity.recipeId) {
    targets.push({ targetType: 'recipe', target: identity.recipeId })
  }

  for (const url of [identity.submittedUrl, identity.canonicalUrl]) {
    if (!url) continue
    const normalized = normalizedSourceUrl(url)
    if (
      normalized &&
      !targets.some(
        (target) =>
          target.targetType === 'source-url' && target.target === normalized,
      )
    ) {
      targets.push({ targetType: 'source-url', target: normalized })
    }
  }

  if (identity.contentFingerprint) {
    targets.push({
      targetType: 'fingerprint',
      target: identity.contentFingerprint.toLowerCase(),
    })
  }

  const domains = new Set<string>()
  if (identity.sourceDomain) {
    domains.add(identity.sourceDomain.replace(/^www\./i, '').toLowerCase())
  }
  for (const url of [identity.submittedUrl, identity.canonicalUrl]) {
    if (!url) continue
    try {
      domains.add(new URL(url).hostname.replace(/^www\./i, '').toLowerCase())
    } catch {
      // The import boundary validates URLs; an invalid optional provenance
      // value should not make the suppression lookup fail open.
    }
  }
  for (const domain of domains) {
    if (
      !targets.some(
        (target) => target.targetType === 'domain' && target.target === domain,
      )
    ) {
      targets.push({ targetType: 'domain', target: domain })
    }
  }

  if (targets.length === 0) return null

  return db
    .collection<PublicContentSuppressionDocument>('public_content_suppressions')
    .findOne(
      {
        status: 'active',
        $or: targets,
      },
      session ? { session } : undefined,
    )
}

export function toPublicContentSuppressionSummary(
  document: PublicContentSuppressionDocument,
): PublicContentSuppressionSummary {
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

export async function findPublicContentSuppressions(db: Db, limit = 100) {
  return db
    .collection<PublicContentSuppressionDocument>('public_content_suppressions')
    .find({})
    .sort({ status: 1, createdAt: -1, _id: 1 })
    .limit(limit)
    .toArray()
}
