import { createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { z } from 'zod'
import { serverEnv, type ServerEnv } from '@/lib/env/server'
import {
  isoDateTime,
  opaqueIdSchema,
  type IsoDateTime,
} from '@/lib/contracts/ids'

/**
 * Private-content access is intentionally narrower than the administrator
 * role. These purposes are the only policy-approved reasons for a future
 * support reader to request a short-lived access grant.
 */
export const adminPrivateContentAccessPurposeSchema = z.enum([
  'support-case',
  'legal-request',
  'security-incident',
])

export type AdminPrivateContentAccessPurpose = z.infer<
  typeof adminPrivateContentAccessPurposeSchema
>

const caseReferenceSchema = z
  .string({ error: 'Enter an operator case reference.' })
  .trim()
  .min(3, 'Case references must be at least 3 characters.')
  .max(120, 'Case references must be 120 characters or fewer.')
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
    'Case references may contain only letters, numbers, dots, underscores, colons, slashes, and hyphens.',
  )

/** Request boundary for an exceptional, explicitly scoped private read. */
export const adminPrivateContentAccessRequestSchema = z.strictObject({
  targetUserId: opaqueIdSchema,
  purpose: adminPrivateContentAccessPurposeSchema,
  caseReference: caseReferenceSchema,
})

export type AdminPrivateContentAccessRequest = z.infer<
  typeof adminPrivateContentAccessRequestSchema
>

export type AdminPrivateContentAccessPolicy = {
  enabled: boolean
  maxDurationMinutes: number
}

export function adminPrivateContentAccessPolicy(
  environment: Pick<
    ServerEnv,
    'ADMIN_PRIVATE_CONTENT_ACCESS_ENABLED'
  > = serverEnv(),
): AdminPrivateContentAccessPolicy {
  return {
    enabled: environment.ADMIN_PRIVATE_CONTENT_ACCESS_ENABLED,
    // Keep any exceptional grant short-lived; a separate request is required
    // when a support case genuinely needs more time.
    maxDurationMinutes: 15,
  }
}

export type AdminPrivateContentAccessGrant = {
  accessId: string
  actorId: string
  targetUserId: string
  purpose: AdminPrivateContentAccessPurpose
  caseReference: string
  grantedAt: IsoDateTime
  expiresAt: IsoDateTime
}

type AdminPrivateContentAccessDenial = {
  allowed: false
  code:
    | 'ADMINISTRATOR_REQUIRED'
    | 'PRIVATE_CONTENT_ACCESS_DISABLED'
    | 'INVALID_REQUEST'
  detail: string
}

export type AdminPrivateContentAccessDecision =
  | { allowed: true; grant: AdminPrivateContentAccessGrant }
  | AdminPrivateContentAccessDenial

export function authorizeAdminPrivateContentAccess({
  actorId,
  actorRole,
  request,
  policy,
  now = new Date(),
}: {
  actorId: string
  actorRole: string
  request: unknown
  policy: AdminPrivateContentAccessPolicy
  now?: Date
}): AdminPrivateContentAccessDecision {
  if (actorRole !== 'admin') {
    return {
      allowed: false,
      code: 'ADMINISTRATOR_REQUIRED',
      detail: 'Only administrators can request exceptional private access.',
    }
  }

  if (!policy.enabled) {
    return {
      allowed: false,
      code: 'PRIVATE_CONTENT_ACCESS_DISABLED',
      detail:
        'Exceptional private-content access is disabled by the instance policy.',
    }
  }

  const parsed = adminPrivateContentAccessRequestSchema.safeParse(request)
  if (!parsed.success) {
    return {
      allowed: false,
      code: 'INVALID_REQUEST',
      detail:
        'Provide a valid target account, approved purpose, and operator case reference.',
    }
  }

  const durationMs = policy.maxDurationMinutes * 60_000
  const grantedAt = isoDateTime(now)
  const expiresAt = isoDateTime(new Date(now.getTime() + durationMs))

  return {
    allowed: true,
    grant: {
      accessId: crypto.randomUUID(),
      actorId,
      targetUserId: parsed.data.targetUserId,
      purpose: parsed.data.purpose,
      caseReference: parsed.data.caseReference,
      grantedAt,
      expiresAt,
    },
  }
}

export function isAdminPrivateContentAccessActive(
  grant: Pick<AdminPrivateContentAccessGrant, 'expiresAt'>,
  now = new Date(),
) {
  return new Date(grant.expiresAt).getTime() > now.getTime()
}

export type AdminPrivateContentAccessAuditDocument = {
  _id: string
  action: 'access-granted'
  actorId: string
  targetUserFingerprint: string
  purpose: AdminPrivateContentAccessPurpose
  caseReference: string
  grantedAt: IsoDateTime
  expiresAt: IsoDateTime
  occurredAt: IsoDateTime
}

function targetUserFingerprint(userId: string) {
  return createHash('sha256')
    .update(`platter-admin-private-content-target:${userId}`)
    .digest('hex')
}

/**
 * Persist only metadata needed to prove why an exceptional grant existed.
 * Raw target IDs and private-content explanations never enter the audit log.
 */
export async function recordAdminPrivateContentAccessAudit(
  db: Db,
  grant: AdminPrivateContentAccessGrant,
  now = new Date(),
) {
  const document: AdminPrivateContentAccessAuditDocument = {
    _id: grant.accessId,
    action: 'access-granted',
    actorId: grant.actorId,
    targetUserFingerprint: targetUserFingerprint(grant.targetUserId),
    purpose: grant.purpose,
    caseReference: grant.caseReference,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    occurredAt: isoDateTime(now),
  }
  await db
    .collection<AdminPrivateContentAccessAuditDocument>(
      'admin_private_content_access_audit',
    )
    .insertOne(document)
  return document
}
