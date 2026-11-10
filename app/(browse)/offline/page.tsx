import { OfflineSnapshotView } from '@/components/states/offline-snapshot-view'
import { getSession } from '@/lib/auth/authorization'

export default async function OfflinePage() {
  const session = await getSession()
  return <OfflineSnapshotView userId={session?.user.id} />
}
