import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import {
  findInvitationForNotification,
  notificationIdSchema,
} from '@/lib/notifications'
import {
  invitationIsExpired,
  invitationAcceptanceResponseSchema,
  invitationRecipientResponseSchema,
  toInvitationRecipientSummary,
  type InvitationDocument,
} from '@/lib/invitations'
import { toPlatterList, type ListDocument } from '@/lib/lists'
import { checkRateLimit } from '@/lib/security/rate-limit'

type RouteContext = { params: Promise<{ notificationId: string }> }

function invitationNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-not-found',
    title: 'Invitation not found',
    status: 404,
    detail: 'That invitation is not available to you.',
    code: 'INVITATION_NOT_FOUND',
  })
}

function invitationExpired() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-expired',
    title: 'Invitation expired',
    status: 410,
    detail:
      'This invitation has expired. Ask the list owner to send a new one.',
    code: 'INVITATION_EXPIRED',
  })
}

function invitationNoLongerAvailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-unavailable',
    title: 'Invitation is no longer available',
    status: 409,
    detail: 'This invitation has already been used or revoked.',
    code: 'INVITATION_UNAVAILABLE',
  })
}

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with the invited email address to accept this invitation.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function invitedAccountRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-account-mismatch',
    title: 'Use the invited account',
    status: 403,
    detail: 'Sign in with the invited email address to accept this invitation.',
    code: 'INVITATION_ACCOUNT_MISMATCH',
  })
}

function invitationRateLimited(retryAfterSeconds: number) {
  const response = problemResponse({
    type: 'https://platter.dev/problems/rate-limit-exceeded',
    title: 'Too many acceptance attempts',
    status: 429,
    detail:
      'Too many attempts were made to accept invitations. Try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  })
  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}

function invitationUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-unavailable',
    title: 'Invitation temporarily unavailable',
    status: 503,
    detail: 'The invitation could not be loaded. Try again shortly.',
    code: 'INVITATION_UNAVAILABLE',
  })
}

function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  return (
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function invitationStateError(invitation: InvitationDocument) {
  if (invitation.status !== 'pending') return invitationNoLongerAvailable()
  if (invitationIsExpired(invitation)) return invitationExpired()
  return null
}

async function readInvitation(notificationId: string, userId: string) {
  return findInvitationForNotification(
    await getConnectedDatabase(),
    notificationId,
    userId,
  )
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) return authenticationRequired()

    const { notificationId } = await context.params
    if (!notificationIdSchema.safeParse(notificationId).success) {
      return invitationNotFound()
    }

    const record = await readInvitation(notificationId, session.user.id)
    if (!record) return invitationNotFound()
    if (session.user.email.trim().toLowerCase() !== record.invitation.email) {
      return invitedAccountRequired()
    }

    const stateError = invitationStateError(record.invitation)
    if (stateError) return stateError

    const response = invitationRecipientResponseSchema.safeParse({
      invitation: toInvitationRecipientSummary(
        record.invitation,
        record.list.name,
      ),
    })
    if (!response.success) return invitationUnavailable()

    return Response.json(response.data)
  } catch {
    return invitationUnavailable()
  }
}

class ListUnavailableError extends Error {}

export async function POST(request: Request, context: RouteContext) {
  let accepted:
    { invitation: InvitationDocument; list: ListDocument } | undefined

  try {
    const session = await getSession()
    if (!session) return authenticationRequired()

    const { notificationId } = await context.params
    if (!notificationIdSchema.safeParse(notificationId).success) {
      return invitationNotFound()
    }

    const rateLimit = checkRateLimit(
      `invitation:accept:notification:${clientKey(request)}`,
      { limit: 10, windowMs: 60 * 1000 },
    )
    if (!rateLimit.allowed) {
      return invitationRateLimited(rateLimit.retryAfterSeconds)
    }

    const record = await readInvitation(notificationId, session.user.id)
    if (!record) return invitationNotFound()

    const stateError = invitationStateError(record.invitation)
    if (stateError) return stateError
    if (session.user.email.trim().toLowerCase() !== record.invitation.email) {
      return invitedAccountRequired()
    }

    const db = await getConnectedDatabase()
    const invitationCollection =
      db.collection<InvitationDocument>('list_invitations')
    const listCollection = db.collection<ListDocument>('lists')
    const now = new Date()
    const updatedAt = isoDateTime(now)

    await getMongoClient().withSession(async (mongoSession) => {
      await mongoSession.withTransaction(async (transactionSession) => {
        const invitation = await invitationCollection.findOneAndUpdate(
          {
            _id: record.invitation._id,
            status: 'pending',
            expiresAt: { $gt: updatedAt },
          },
          { $set: { status: 'accepted', updatedAt } },
          { returnDocument: 'after', session: transactionSession },
        )
        if (!invitation) return

        const currentList = await listCollection.findOne(
          { _id: invitation.listId, status: { $ne: 'deleted' } },
          { session: transactionSession },
        )
        if (!currentList) throw new ListUnavailableError()

        const existingMember = currentList.members.some(
          (member) => member.userId === session.user.id,
        )
        const list = existingMember
          ? currentList
          : await listCollection.findOneAndUpdate(
              {
                _id: invitation.listId,
                status: { $ne: 'deleted' },
                'members.userId': { $ne: session.user.id },
              },
              {
                $addToSet: {
                  members: {
                    userId: session.user.id,
                    role: 'editor',
                    invitationState: 'active',
                  },
                },
                $set: { updatedAt },
              },
              {
                returnDocument: 'after',
                session: transactionSession,
              },
            )
        if (!list) throw new ListUnavailableError()

        accepted = { invitation, list }
      })
    })
  } catch (error) {
    if (error instanceof ListUnavailableError) return invitationNotFound()
    return invitationUnavailable()
  }

  if (!accepted) return invitationNoLongerAvailable()

  const response = invitationAcceptanceResponseSchema.safeParse({
    invitation: toInvitationRecipientSummary(
      accepted.invitation,
      accepted.list.name,
    ),
    list: toPlatterList(accepted.list),
  })
  if (!response.success) return invitationUnavailable()

  return Response.json(response.data)
}
