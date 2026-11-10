import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'
import { safeReturnPath } from './return-to'
import type { EntityId } from '@/lib/contracts/ids'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ListMember,
  type ListRole,
} from '@/lib/lists'

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession()
  if (!session) {
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`,
    )
  }
  return session as Session
}

export async function requireListRole(
  listId: EntityId,
  roles: readonly ListRole[] = ['owner', 'editor'],
) {
  const session = await requireSession()
  const membership = await findListForRole(listId, session.user.id, roles)
  if (!membership) redirect('/lists')
  return { session, ...membership }
}

export async function findListForRole(
  listId: string,
  userId: string,
  roles: readonly ListRole[] = ['owner', 'editor'],
): Promise<{ list: ListDocument; member: ListMember } | null> {
  if (!listIdSchema.safeParse(listId).success || roles.length === 0) {
    return null
  }

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, userId, roles))
  if (!list) return null

  const member = list.members.find(
    (candidate) =>
      candidate.userId === userId &&
      candidate.invitationState === 'active' &&
      roles.includes(candidate.role),
  )
  return member ? { list, member } : null
}

export async function requireAdmin() {
  const session = await requireSession()
  if (session.user.role !== 'admin') redirect('/lists')
  return session
}
