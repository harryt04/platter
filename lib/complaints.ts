import { z } from 'zod'
import type { Db } from 'mongodb'
import {
  isoDateTime,
  opaqueIdSchema,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import { sanitizePlainText } from '@/lib/contracts/text'

const cleanText = sanitizePlainText

const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const cleaned = cleanText(value)
      return cleaned === '' ? undefined : cleaned
    },
    z
      .string({ error: `Enter a ${label}.` })
      .max(max, `${label} must be ${max} characters or fewer.`)
      .optional(),
  )

const sourceUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .url({ error: 'Enter a valid source URL.' })
    .max(2048, 'Source URLs must be 2,048 characters or fewer.')
    .refine(
      (value) => value.startsWith('https://') || value.startsWith('http://'),
      'Source URL must use HTTP or HTTPS.',
    )
    .refine((value) => {
      try {
        const url = new URL(value)
        return !url.username && !url.password
      } catch {
        return false
      }
    }, 'Source URL cannot contain sign-in credentials.')
    .optional(),
)

export const complaintTypeSchema = z.enum([
  'copyright',
  'source-removal',
  'incorrect-attribution',
  'other',
])

export const complaintStatusSchema = z.enum([
  'received',
  'actioned',
  'countered',
  'restored',
  'closed',
])

export const complaintIdSchema = z.string().uuid('Enter a valid complaint id.')

/** Public callers receive only this minimal, non-sensitive receipt. */
export const complaintReceiptSchema = z.strictObject({
  id: opaqueIdSchema,
  status: complaintStatusSchema,
  receivedAt: z.string().datetime(),
})

export const updateComplaintStatusSchema = z.object({
  status: complaintStatusSchema,
})

export const createComplaintSchema = z
  .object({
    type: complaintTypeSchema,
    recipeId: optionalText('recipe id', 200),
    sourceUrl: sourceUrlSchema,
    description: z
      .string({ error: 'Describe the material to review.' })
      .transform(cleanText)
      .pipe(
        z
          .string()
          .min(1, 'Describe the material to review.')
          .max(4000, 'Descriptions must be 4,000 characters or fewer.'),
      ),
    contactName: optionalText('contact name', 200),
    contactEmail: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value
        const cleaned = cleanText(value)
        return cleaned === '' ? undefined : cleaned.toLowerCase()
      },
      z
        .email({ error: 'Enter a valid contact email.' })
        .max(320, 'Contact emails must be 320 characters or fewer.')
        .optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.recipeId || value.sourceUrl) return
    context.addIssue({
      code: 'custom',
      path: ['recipeId'],
      message: 'Enter a public recipe id or source URL to review.',
    })
  })

export type ComplaintType = z.infer<typeof complaintTypeSchema>
export type ComplaintStatus = z.infer<typeof complaintStatusSchema>
export type CreateComplaint = z.infer<typeof createComplaintSchema>
export type UpdateComplaintStatus = z.infer<typeof updateComplaintStatusSchema>

export type ComplaintStatusEvent = {
  status: ComplaintStatus
  changedAt: IsoDateTime
  actorType: 'public-submission' | 'administrator'
  actorId?: string
}

export type ComplaintDocument = {
  _id: string
  recipeId?: string
  sourceUrl?: string
  type: ComplaintType
  status: ComplaintStatus
  description: string
  contact?: {
    name?: string
    email?: string
  }
  receivedAt: IsoDateTime
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  statusHistory: ComplaintStatusEvent[]
}

export const complaintAuditActionSchema = z.enum([
  'queue-viewed',
  'status-changed',
])

export type ComplaintAuditAction = z.infer<typeof complaintAuditActionSchema>

/**
 * Metadata-only audit records deliberately contain identifiers and status
 * changes, never complaint descriptions, source URLs, or contact details.
 */
export type ComplaintAuditDocument = {
  _id: string
  action: ComplaintAuditAction
  actorId: string
  complaintIds: string[]
  fromStatus?: ComplaintStatus
  toStatus?: ComplaintStatus
  occurredAt: IsoDateTime
}

export async function recordComplaintAudit(
  db: Db,
  input: Omit<ComplaintAuditDocument, '_id' | 'occurredAt'>,
  now = new Date(),
) {
  const document: ComplaintAuditDocument = {
    _id: crypto.randomUUID(),
    ...input,
    occurredAt: isoDateTime(now),
  }
  await db
    .collection<ComplaintAuditDocument>('complaint_access_audit')
    .insertOne(document)
  return document
}

export function createComplaintDocument(
  input: CreateComplaint,
  now = new Date(),
): ComplaintDocument {
  const timestamp = isoDateTime(now)
  const contact =
    input.contactName || input.contactEmail
      ? {
          ...(input.contactName ? { name: input.contactName } : {}),
          ...(input.contactEmail ? { email: input.contactEmail } : {}),
        }
      : undefined

  return {
    _id: crypto.randomUUID(),
    ...(input.recipeId ? { recipeId: input.recipeId } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    type: input.type,
    status: 'received',
    description: input.description,
    ...(contact ? { contact } : {}),
    receivedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    statusHistory: [
      {
        status: 'received',
        changedAt: timestamp,
        actorType: 'public-submission',
      },
    ],
  }
}

export function toComplaintReceipt(document: ComplaintDocument) {
  return {
    id: document._id,
    status: document.status,
    receivedAt: document.receivedAt,
  }
}

export type AdminComplaintSummary = Omit<
  ComplaintDocument,
  '_id' | 'statusHistory'
> & {
  id: string
  statusHistory: ComplaintStatusEvent[]
}

export function toAdminComplaintSummary(
  document: ComplaintDocument,
): AdminComplaintSummary {
  return {
    id: document._id,
    ...(document.recipeId ? { recipeId: document.recipeId } : {}),
    ...(document.sourceUrl ? { sourceUrl: document.sourceUrl } : {}),
    type: document.type,
    status: document.status,
    description: document.description,
    ...(document.contact ? { contact: document.contact } : {}),
    receivedAt: document.receivedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    statusHistory: document.statusHistory,
  }
}

const complaintTransitions: Record<
  ComplaintStatus,
  readonly ComplaintStatus[]
> = {
  received: ['actioned', 'countered', 'closed'],
  actioned: ['countered', 'restored', 'closed'],
  countered: ['actioned', 'restored', 'closed'],
  restored: ['actioned', 'closed'],
  closed: [],
}

export function canTransitionComplaint(
  from: ComplaintStatus,
  to: ComplaintStatus,
) {
  return from === to || complaintTransitions[from].includes(to)
}

export function complaintNextStatuses(status: ComplaintStatus) {
  return complaintTransitions[status]
}
