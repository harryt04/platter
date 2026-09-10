import { PlaceholderPage } from '@/components/states/placeholder-page'
import { requireSession } from '@/lib/auth/authorization'
import { findListForMember } from '@/lib/lists'
import { notFound } from 'next/navigation'
export default async function ListHistoryPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/history`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  return (
    <PlaceholderPage
      title="Completed runs"
      description={`A minimal history for the ${list.name} list will preserve dates and selected recipe versions.`}
    />
  )
}
