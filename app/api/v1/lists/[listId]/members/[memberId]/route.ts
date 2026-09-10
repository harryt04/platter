import { getSession, findListForRole } from '@/lib/auth/authorization'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { listIdSchema, toPlatterList, type ListDocument } from '@/lib/lists'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { z } from 'zod'
import { safelyCreateUserNotification } from '@/lib/notifications'

type RouteContext = {
  params: Promise<{ listId: string; memberId: string }>
}

const memberIdSchema = z
  .string({ error: 'Enter a member id.' })
  .trim()
  .min(1, 'Enter a member id.')
  .max(200, 'Member ids must be 200 characters or fewer.')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'Member ids cannot contain control characters.',
  )

const updateMemberSchema = z.object({
  role: z.enum(['owner', 'editor']),
})

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to manage members for a list.',
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

function memberNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/member-not-found',
    title: 'Member not found',
    status: 404,
    detail: 'That active member is not part of this list.',
    code: 'MEMBER_NOT_FOUND',
  })
}

function lastOwner() {
  return problemResponse({
    type: 'https://platter.dev/problems/last-owner',
    title: 'The list needs an owner',
    status: 409,
    detail:
      'Transfer ownership to another member before removing or demoting the last owner.',
    code: 'LAST_OWNER_REQUIRED',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send a JSON object with a member role.',
    code: 'INVALID_JSON',
  })
}

async function readOwnerList(listId: string, userId: string) {
  return findListForRole(listId, userId, ['owner'])
}

function memberFilter(
  listId: string,
  userId: string,
  memberId: string,
  role: 'owner' | 'editor',
  updatedAt: IsoDateTime,
) {
  return {
    _id: listId,
    status: { $ne: 'deleted' as const },
    updatedAt,
    members: {
      $elemMatch: {
        userId,
        role: 'owner' as const,
        invitationState: 'active' as const,
      },
    },
    $and: [
      {
        members: {
          $elemMatch: {
            userId: memberId,
            role,
            invitationState: 'active' as const,
          },
        },
      },
    ],
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, memberId: rawMemberId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()
  const memberIdResult = memberIdSchema.safeParse(rawMemberId)
  if (!memberIdResult.success) return memberNotFound()
  const memberId = memberIdResult.data

  const result = await readOwnerList(listId, session.user.id)
  if (!result) return listNotFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }
  const parsed = updateMemberSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the member role',
      status: 422,
      detail: 'Choose whether the member is an owner or editor.',
      code: 'VALIDATION_FAILED',
      fields: { role: ['Choose owner or editor.'] },
    })
  }

  const target = result.list.members.find(
    (member) => member.userId === memberId,
  )
  if (!target) return memberNotFound()
  if (target.role === parsed.data.role) {
    return Response.json({ member: target, list: toPlatterList(result.list) })
  }
  if (parsed.data.role === 'editor' && result.list.ownerIds.length < 2) {
    return lastOwner()
  }

  const updatedAt = isoDateTime(new Date())
  const members = result.list.members.map((member) =>
    member.userId === memberId ? { ...member, role: parsed.data.role } : member,
  )
  const ownerIds =
    parsed.data.role === 'owner'
      ? [...new Set([...result.list.ownerIds, memberId])]
      : result.list.ownerIds.filter((ownerId) => ownerId !== memberId)

  const db = await getConnectedDatabase()
  const updated = await db
    .collection<ListDocument>('lists')
    .findOneAndUpdate(
      memberFilter(
        listId,
        session.user.id,
        memberId,
        target.role,
        result.list.updatedAt,
      ),
      { $set: { members, ownerIds, updatedAt } },
      { returnDocument: 'after' },
    )
  if (!updated) return memberNotFound()

  const member = updated.members.find(
    (candidate) => candidate.userId === memberId,
  )
  if (!member) return memberNotFound()
  await safelyCreateUserNotification(db, {
    userId: memberId,
    event: 'role-changed',
    listId: updated._id,
    listName: updated.name,
    role: member.role,
  })
  return Response.json({ member, list: toPlatterList(updated) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, memberId: rawMemberId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()
  const memberIdResult = memberIdSchema.safeParse(rawMemberId)
  if (!memberIdResult.success) return memberNotFound()
  const memberId = memberIdResult.data

  const result = await readOwnerList(listId, session.user.id)
  if (!result) return listNotFound()
  const target = result.list.members.find(
    (member) => member.userId === memberId,
  )
  if (!target || target.role !== 'editor') return memberNotFound()

  const updated = await (
    await getConnectedDatabase()
  )
    .collection<ListDocument>('lists')
    .findOneAndUpdate(
      memberFilter(
        listId,
        session.user.id,
        memberId,
        'editor',
        result.list.updatedAt,
      ),
      {
        $pull: { members: { userId: memberId } },
        $set: { updatedAt: isoDateTime(new Date()) },
      },
      { returnDocument: 'after' },
    )
  if (!updated) return memberNotFound()

  await safelyCreateUserNotification(await getConnectedDatabase(), {
    userId: memberId,
    event: 'removed',
    listId: updated._id,
    listName: updated.name,
  })

  return Response.json({ list: toPlatterList(updated) })
}
