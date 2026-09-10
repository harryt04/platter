import { PlaceholderPage } from '@/components/states/placeholder-page'
export default async function RunHistoryPage({
  params,
}: {
  params: Promise<{ listId: string; runId: string }>
}) {
  const { listId, runId } = await params
  return (
    <PlaceholderPage
      title="Completed shopping run"
      description={`Run ${runId} for ${listId} will show its completion date and immutable selected recipe versions.`}
    />
  )
}
