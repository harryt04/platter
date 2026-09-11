import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  canTransitionComplaint,
  complaintIdSchema,
  recordComplaintAudit,
  toAdminComplaintSummary,
  updateComplaintStatusSchema,
  type ComplaintDocument,
} from '@/lib/complaints'

type RouteContext = { params: Promise<{ complaintId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with an administrator account to update complaints.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function administratorRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/administrator-required',
    title: 'Administrator access required',
    status: 403,
    detail: 'Only administrators can update public-content complaints.',
    code: 'ADMINISTRATOR_REQUIRED',
  })
}

function complaintNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/complaint-not-found',
    title: 'Complaint not found',
    status: 404,
    detail: 'That complaint is not available to this administrator.',
    code: 'COMPLAINT_NOT_FOUND',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid complaint update',
    status: 400,
    detail: 'Send a JSON object containing the next complaint status.',
    code: 'INVALID_JSON',
  })
}

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the complaint status',
    status: 422,
    detail: 'Choose a valid complaint status.',
    code: 'VALIDATION_FAILED',
  })
}

function transitionNotAllowed() {
  return problemResponse({
    type: 'https://platter.dev/problems/complaint-transition-not-allowed',
    title: 'Complaint cannot move to that status',
    status: 409,
    detail: 'Choose an allowed next status for this complaint.',
    code: 'COMPLAINT_TRANSITION_NOT_ALLOWED',
  })
}

function complaintStorageUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/admin-complaint-storage-unavailable',
    title: 'Complaint update temporarily unavailable',
    status: 503,
    detail:
      'The administrator complaint update is temporarily unavailable. Try again shortly.',
    code: 'ADMIN_COMPLAINT_STORAGE_UNAVAILABLE',
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (session.user.role !== 'admin') return administratorRequired()

  const { complaintId } = await context.params
  if (!complaintIdSchema.safeParse(complaintId).success) {
    return complaintNotFound()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = updateComplaintStatusSchema.safeParse(body)
  if (!parsed.success) return validationFailed()

  try {
    const db = await getConnectedDatabase()
    const complaints = db.collection<ComplaintDocument>('complaints')
    const current = await complaints.findOne({ _id: complaintId })
    if (!current) return complaintNotFound()
    if (!canTransitionComplaint(current.status, parsed.data.status)) {
      return transitionNotAllowed()
    }
    if (current.status === parsed.data.status) {
      return Response.json({ complaint: toAdminComplaintSummary(current) })
    }

    const changedAt = isoDateTime(new Date())
    const updated = await complaints.findOneAndUpdate(
      { _id: complaintId, status: current.status },
      {
        $set: {
          status: parsed.data.status,
          updatedAt: changedAt,
        },
        $push: {
          statusHistory: {
            status: parsed.data.status,
            changedAt,
            actorType: 'administrator',
            actorId: session.user.id,
          },
        },
      },
      { returnDocument: 'after' },
    )
    if (!updated) return transitionNotAllowed()

    await recordComplaintAudit(db, {
      action: 'status-changed',
      actorId: session.user.id,
      complaintIds: [complaintId],
      fromStatus: current.status,
      toStatus: parsed.data.status,
    })

    return Response.json({ complaint: toAdminComplaintSummary(updated) })
  } catch {
    return complaintStorageUnavailable()
  }
}
