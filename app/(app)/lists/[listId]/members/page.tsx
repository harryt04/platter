import { PlaceholderPage } from '@/components/states/placeholder-page'
export default async function MembersPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  return (
    <PlaceholderPage
      title={`${listId === 'personal' ? 'Personal' : 'Family'} members`}
      description="Members, roles, invitations, and owner-only actions will be backed by the Lists feature."
      action="Return to list"
      actionHref={`/lists/${listId}`}
    />
  )
}
