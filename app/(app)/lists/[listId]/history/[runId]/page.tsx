import { PlaceholderPage } from '@/components/states/placeholder-page'
import { requireSession } from '@/lib/auth/authorization'
import { findListForMember } from '@/lib/lists'
import { notFound } from 'next/navigation'
export default async function RunHistoryPage({
  params,
}: {
  params: Promise<{ listId: string; runId: string }>
}) {
  const { listId, runId } = await params
  const session = await requireSession(`/lists/${listId}/history/${runId}`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  return (
    <PlaceholderPage
      title="Completed shopping run"
      description={`Run ${runId} for ${list.name} will show its completion date and immutable selected recipe versions.`}
    />
  )
}
