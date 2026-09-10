import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'

const cleanText = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()

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
