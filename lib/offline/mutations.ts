import { entityId, isoDateTime } from '@/lib/contracts/ids'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import { queueOfflineOperation } from '@/lib/offline/database'

export function browserIsOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export async function queueBrowserMutation({
  userId,
  listId,
  runId,
  kind,
  payload,
  baseRevision,
}: {
  userId?: string
  listId: string
  runId?: string
  kind: string
  payload: unknown
  baseRevision?: number
}) {
  if (!userId || !runId) {
    throw new Error('Reconnect before making this change offline.')
  }

  const metadata = createMutationMetadata(baseRevision)
  return queueOfflineOperation(userId, {
    ...metadata,
    listId: entityId(listId),
    runId: entityId(runId),
    kind,
    payload,
    createdAt: isoDateTime(new Date()),
  })
}
