import { PlaceholderPage } from '@/components/states/placeholder-page'
export default async function ListHistoryPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  return (
    <PlaceholderPage
      title="Completed runs"
      description={`A minimal history for the ${listId === 'personal' ? 'Personal' : 'Family'} list will preserve dates and selected recipe versions.`}
    />
  )
}
