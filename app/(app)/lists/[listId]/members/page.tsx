import { PlaceholderPage } from '@/components/states/placeholder-page'
import { requireSession } from '@/lib/auth/authorization'
import { findListForMember } from '@/lib/lists'
import { notFound } from 'next/navigation'
export default async function MembersPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/members`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  return (
    <PlaceholderPage
      title={`${list.name} members`}
      description="Members, roles, invitations, and owner-only actions will be backed by the Lists feature."
      action="Return to list"
      actionHref={`/lists/${listId}`}
    />
  )
}
