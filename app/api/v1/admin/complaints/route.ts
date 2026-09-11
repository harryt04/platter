import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  adminComplaintQueueResponseSchema,
  complaintDocumentSchema,
  recordComplaintAudit,
  toAdminComplaintSummary,
  type ComplaintDocument,
} from '@/lib/complaints'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with an administrator account to view complaints.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function administratorRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/administrator-required',
    title: 'Administrator access required',
    status: 403,
    detail: 'Only administrators can access public-content complaints.',
    code: 'ADMINISTRATOR_REQUIRED',
  })
}

function complaintQueueUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/admin-complaint-queue-unavailable',
    title: 'Complaint queue temporarily unavailable',
    status: 503,
    detail:
      'The administrator complaint queue is temporarily unavailable. Try again shortly.',
    code: 'ADMIN_COMPLAINT_QUEUE_UNAVAILABLE',
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (session.user.role !== 'admin') return administratorRequired()

  try {
    const db = await getConnectedDatabase()
    const documents = await db
      .collection<ComplaintDocument>('complaints')
      .find({})
      .sort({ receivedAt: -1, _id: -1 })
      .limit(100)
      .toArray()

    const validatedDocuments = documents.map((document) =>
      complaintDocumentSchema.safeParse(document),
    )
    if (validatedDocuments.some((result) => !result.success)) {
      return complaintQueueUnavailable()
    }

    const parsedDocuments = validatedDocuments.map(
      (result) => result.data as ComplaintDocument,
    )

    const response = adminComplaintQueueResponseSchema.safeParse({
      complaints: parsedDocuments.map(toAdminComplaintSummary),
    })
    if (!response.success) return complaintQueueUnavailable()

    await recordComplaintAudit(db, {
      action: 'queue-viewed',
      actorId: session.user.id,
      complaintIds: parsedDocuments.map((document) => document._id),
    })

    return Response.json(response.data)
  } catch {
    return complaintQueueUnavailable()
  }
}
