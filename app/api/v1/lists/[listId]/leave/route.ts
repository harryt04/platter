import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import {
  listIdSchema,
  listMemberFilter,
  toPlatterList,
  type ListDocument,
} from '@/lib/lists'

type RouteContext = { params: Promise<{ listId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to leave a list.',
    code: 'AUTHENTICATION_REQUIRED',
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

function lastOwner() {
  return problemResponse({
    type: 'https://platter.dev/problems/last-owner',
    title: 'The list needs an owner',
    status: 409,
    detail:
      'Transfer ownership to another member before leaving the last-owned list.',
    code: 'LAST_OWNER_REQUIRED',
  })
}

function leaveFilter(listId: string, userId: string, role: 'owner' | 'editor') {
  return {
    _id: listId,
    status: { $ne: 'deleted' as const },
    $or:
      role === 'owner'
        ? [
            {
              members: {
                $elemMatch: {
                  userId,
                  role: 'owner' as const,
                  invitationState: 'active' as const,
                },
              },
              'ownerIds.1': { $exists: true },
            },
          ]
        : [
            {
              members: {
                $elemMatch: {
                  userId,
                  role: 'editor' as const,
                  invitationState: 'active' as const,
                },
              },
            },
          ],
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()
  const db = await getConnectedDatabase()
  const current = await db
    .collection<ListDocument>('lists')
    .findOne(listMemberFilter(listId, session.user.id))
  if (!current) return listNotFound()

  const member = current.members.find(
    (candidate) => candidate.userId === session.user.id,
  )
  if (!member) return listNotFound()
  if (member.role === 'owner' && current.ownerIds.length < 2) {
    return lastOwner()
  }

  const updated = await db.collection<ListDocument>('lists').findOneAndUpdate(
    leaveFilter(listId, session.user.id, member.role),
    {
      $pull: {
        members: { userId: session.user.id },
        ownerIds: session.user.id,
      },
      $set: { updatedAt: isoDateTime(new Date()) },
    },
    { returnDocument: 'after' },
  )

  if (!updated) return listNotFound()

  return Response.json({ list: toPlatterList(updated) })
}
