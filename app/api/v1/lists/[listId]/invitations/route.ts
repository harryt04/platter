import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { listIdSchema, listOwnerFilter, type ListDocument } from '@/lib/lists'
import { serverEnv } from '@/lib/env/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import {
  createInvitationDocument,
  createInvitationSchema,
  invitations,
  toInvitationSummary,
  type InvitationDocument,
} from '@/lib/invitations'
import { notifyExistingUserByEmail } from '@/lib/notifications'
import { sendInvitationEmail } from '@/lib/auth/mailer'

type RouteContext = { params: Promise<{ listId: string }> }

function authenticationRequired(action = 'manage invitations') {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: `Sign in to ${action} for a list.`,
    code: 'AUTHENTICATION_REQUIRED',
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('view invitations')

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listOwnerFilter(listId, session.user.id))
  if (!list) return listNotFound()

  const documents = await invitations(
    db.collection<InvitationDocument>('list_invitations'),
  )
    .find({ listId })
    .sort({ createdAt: -1 })
    .toArray()

  return Response.json({
    invitations: documents.map((document) => toInvitationSummary(document)),
  })
}

function listNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-found',
    title: 'List not found',
    status: 404,
    detail: 'That list is not available to you.',
    code: 'LIST_NOT_FOUND',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send a JSON object with the recipient email address.',
    code: 'INVALID_JSON',
  })
}

function invitationRateLimited(retryAfterSeconds: number) {
  const response = problemResponse({
    type: 'https://platter.dev/problems/rate-limit-exceeded',
    title: 'Too many invitations',
    status: 429,
    detail: 'Too many invitations were created. Try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  })
  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listOwnerFilter(listId, session.user.id))
  if (!list) return listNotFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = createInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the invitation email',
      status: 422,
      detail: 'Enter the email address for the person you want to invite.',
      code: 'VALIDATION_FAILED',
      fields: { email: parsed.error.issues.map((issue) => issue.message) },
    })
  }

  const rateLimit = checkRateLimit(`invitation:create:${session.user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return invitationRateLimited(rateLimit.retryAfterSeconds)
  }

  const env = serverEnv()
  const { document, token } = createInvitationDocument(
    listId,
    session.user.id,
    parsed.data.email,
    new Date(),
    env.INVITATION_TTL_HOURS,
  )
  await invitations(
    db.collection<InvitationDocument>('list_invitations'),
  ).insertOne(document)
  await notifyExistingUserByEmail(db, document.email, {
    event: 'invitation',
    listId: list._id,
    listName: list.name,
    invitationId: document._id,
  }).catch(() => false)

  const inviteUrl = new URL(`/invitations/${token}`, env.APP_URL).toString()
  await sendInvitationEmail(document.email, inviteUrl, list.name).catch(
    () => false,
  )
  return Response.json(
    { invitation: toInvitationSummary(document, inviteUrl) },
    { status: 201 },
  )
}
