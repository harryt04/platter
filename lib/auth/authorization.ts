import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'
import type { EntityId } from '@/lib/contracts/ids'

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession()
  if (!session) {
    const safeReturn =
      returnTo?.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/lists'
    redirect(`/sign-in?returnTo=${encodeURIComponent(safeReturn)}`)
  }
  return session as Session
}

export async function requireListRole(
  _listId: EntityId,
  _roles: readonly string[] = ['owner', 'editor', 'viewer'],
) {
  void _listId
  void _roles
  const session = await requireSession()
  throw new Error(
    `List authorization is reserved for the Lists feature. User ${session.user.id} is authenticated.`,
  )
}

export async function requireAdmin() {
  const session = await requireSession()
  if (session.user.role !== 'admin') redirect('/lists')
  return session
}
