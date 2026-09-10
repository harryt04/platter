import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
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

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (session.user.role !== 'admin') return administratorRequired()

  const db = await getConnectedDatabase()
  const documents = await db
    .collection<ComplaintDocument>('complaints')
    .find({})
    .sort({ receivedAt: -1, _id: -1 })
    .limit(100)
    .toArray()

  await recordComplaintAudit(db, {
    action: 'queue-viewed',
    actorId: session.user.id,
    complaintIds: documents.map((document) => document._id),
  })

  return Response.json({
    complaints: documents.map(toAdminComplaintSummary),
  })
}
