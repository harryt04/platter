import type { QueuedOperation } from '@/lib/contracts/mutations'
import {
  getOfflineOperations,
  updateOfflineOperation,
} from '@/lib/offline/database'

type Payload = Record<string, unknown>

type SyncResponse = {
  response: Response
  body: Record<string, unknown>
}

export type OfflineSyncResult = {
  attempted: number
  synced: number
  failed: number
}

function asPayload(value: unknown): Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('This offline change has an invalid payload.')
  }
  return value as Payload
}

function requiredString(payload: Payload, field: string) {
  const value = payload[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('This offline change is missing required details.')
  }
  return value
}

function fieldKey(operation: QueuedOperation) {
  const payload =
    operation.payload &&
    typeof operation.payload === 'object' &&
    !Array.isArray(operation.payload)
      ? (operation.payload as Payload)
      : {}
  const target =
    typeof payload.itemId === 'string'
      ? payload.itemId
      : typeof payload.additionId === 'string'
        ? payload.additionId
        : operation.operationId
  const field = operation.kind.startsWith('grocery.purchased')
    ? 'purchased'
    : operation.kind.startsWith('grocery.already-have')
      ? 'already-have'
      : operation.kind.startsWith('grocery.amount-override')
        ? 'amount-override'
        : operation.kind.startsWith('grocery.manual-item')
          ? 'manual-item'
          : operation.operationId
  return `${operation.listId}:${operation.runId}:${field}:${target}`
}

function requestFor(
  operation: QueuedOperation,
  baseRevision: number | undefined,
): { url: string; init: RequestInit } {
  const payload = asPayload(operation.payload)
  const metadata = {
    runId: operation.runId,
    operationId: operation.operationId,
    clientId: operation.clientId,
    ...(baseRevision === undefined ? {} : { baseRevision }),
  }
  const listId = encodeURIComponent(operation.listId)
  const itemId =
    typeof payload.itemId === 'string'
      ? encodeURIComponent(payload.itemId)
      : undefined

  if (operation.kind === 'grocery.purchased.set') {
    if (!itemId) throw new Error('This offline purchased change has no item.')
    return {
      url: `/api/v1/lists/${listId}/grocery-items/${itemId}/purchased`,
      init: { method: 'PATCH', body: JSON.stringify(metadata) },
    }
  }
  if (operation.kind === 'grocery.purchased.undo') {
    if (!itemId) throw new Error('This offline purchased change has no item.')
    return {
      url: `/api/v1/lists/${listId}/grocery-items/${itemId}/purchased`,
      init: { method: 'DELETE', body: JSON.stringify(metadata) },
    }
  }
  if (operation.kind === 'grocery.already-have.set') {
    if (!itemId) throw new Error('This offline change has no grocery item.')
    return {
      url: `/api/v1/lists/${listId}/grocery-items/${itemId}/already-have`,
      init: { method: 'PATCH', body: JSON.stringify(metadata) },
    }
  }
  if (operation.kind === 'grocery.already-have.undo') {
    if (!itemId) throw new Error('This offline change has no grocery item.')
    return {
      url: `/api/v1/lists/${listId}/grocery-items/${itemId}/already-have`,
      init: { method: 'DELETE', body: JSON.stringify(metadata) },
    }
  }
  if (operation.kind === 'grocery.amount-override.set') {
    if (!itemId) throw new Error('This offline amount change has no item.')
    const quantity = payload.quantity
    if (!quantity || typeof quantity !== 'object') {
      throw new Error('This offline amount change has no quantity.')
    }
    return {
      url: `/api/v1/lists/${listId}/grocery-items/${itemId}/override`,
      init: {
        method: 'PATCH',
        body: JSON.stringify({ quantity, ...metadata }),
      },
    }
  }
  if (operation.kind === 'grocery.amount-override.reset') {
    if (!itemId) throw new Error('This offline amount change has no item.')
    return {
      url: `/api/v1/lists/${listId}/grocery-items/${itemId}/override`,
      init: { method: 'DELETE', body: JSON.stringify(metadata) },
    }
  }
  if (operation.kind === 'grocery.manual-item.add') {
    return {
      url: `/api/v1/lists/${listId}/manual-items`,
      init: {
        method: 'POST',
        body: JSON.stringify({
          line: requiredString(payload, 'line'),
          ...metadata,
        }),
      },
    }
  }
  if (operation.kind === 'grocery.manual-item.update') {
    const additionId = encodeURIComponent(requiredString(payload, 'additionId'))
    return {
      url: `/api/v1/lists/${listId}/manual-items/${additionId}`,
      init: {
        method: 'PATCH',
        body: JSON.stringify({
          line: requiredString(payload, 'line'),
          ...metadata,
        }),
      },
    }
  }
  if (operation.kind === 'grocery.manual-item.remove') {
    const additionId = encodeURIComponent(requiredString(payload, 'additionId'))
    return {
      url: `/api/v1/lists/${listId}/manual-items/${additionId}`,
      init: { method: 'DELETE', body: JSON.stringify(metadata) },
    }
  }

  throw new Error('This offline change is no longer supported.')
}

async function sendOperation(
  operation: QueuedOperation,
  baseRevision: number | undefined,
  request: typeof fetch,
): Promise<SyncResponse> {
  const { url, init } = requestFor(operation, baseRevision)
  const response = await request(url, {
    ...init,
    headers: { 'content-type': 'application/json' },
  })
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await response.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>
    }
  } catch {
    // The status still determines whether the mutation was accepted.
  }
  return { response, body }
}

function errorMessage(body: Record<string, unknown>, status: number) {
  if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
  if (body.code === 'RUN_COMPLETED') {
    return 'This shopping run was completed on another device. Refresh to use the new active run.'
  }
  if (status === 401 || status === 403) {
    return 'You no longer have permission to apply this offline change.'
  }
  if (status === 404) {
    return 'This grocery item or shopping run is no longer available.'
  }
  return 'This offline change could not be applied. Reconnect and try again.'
}

function isRevisionConflict(body: Record<string, unknown>, status: number) {
  return status === 409 && body.code === 'RUN_REVISION_CONFLICT'
}

/** Synchronize durable offline changes in order while preserving last-write-wins fields. */
export async function synchronizeOfflineOperations(
  userId: string,
  request: typeof fetch = fetch,
): Promise<OfflineSyncResult> {
  const operations = (await getOfflineOperations(userId))
    .filter((operation) => operation.status !== 'synced')
    .sort((left, right) => {
      const created = left.createdAt.localeCompare(right.createdAt)
      return created || left.operationId.localeCompare(right.operationId)
    })
  const latestByField = new Map<string, QueuedOperation>()
  for (const operation of operations) {
    latestByField.set(fieldKey(operation), operation)
  }

  const candidates = [...latestByField.values()].sort((left, right) => {
    const created = left.createdAt.localeCompare(right.createdAt)
    return created || left.operationId.localeCompare(right.operationId)
  })
  const supersededBy = new Map<string, QueuedOperation[]>()
  for (const operation of operations) {
    const latest = latestByField.get(fieldKey(operation))
    if (latest && latest.operationId !== operation.operationId) {
      const prior = supersededBy.get(latest.operationId) ?? []
      prior.push(operation)
      supersededBy.set(latest.operationId, prior)
    }
  }

  const runRevisions = new Map<string, number>()
  for (const operation of candidates) {
    const key = `${operation.listId}:${operation.runId}`
    if (operation.baseRevision !== undefined) {
      runRevisions.set(
        key,
        Math.max(runRevisions.get(key) ?? 0, operation.baseRevision),
      )
    }
  }

  const result: OfflineSyncResult = { attempted: 0, synced: 0, failed: 0 }
  for (const operation of candidates) {
    const runKey = `${operation.listId}:${operation.runId}`
    const attemptCount = operation.attemptCount + 1
    result.attempted += 1
    await updateOfflineOperation(userId, operation.operationId, {
      status: 'syncing',
      attemptCount,
      syncMessage: undefined,
    })

    try {
      let syncResponse = await sendOperation(
        operation,
        runRevisions.get(runKey),
        request,
      )
      if (
        !syncResponse.response.ok &&
        runRevisions.has(runKey) &&
        isRevisionConflict(syncResponse.body, syncResponse.response.status)
      ) {
        // The authoritative run moved while this device was offline. Replay
        // the latest intent without the stale precondition, then use its
        // returned revision for unrelated queued fields.
        syncResponse = await sendOperation(operation, undefined, request)
      }

      if (!syncResponse.response.ok) {
        result.failed += 1
        await updateOfflineOperation(userId, operation.operationId, {
          status: 'failed',
          attemptCount,
          syncMessage: errorMessage(
            syncResponse.body,
            syncResponse.response.status,
          ),
        })
        continue
      }

      const revision = syncResponse.body.revision
      if (typeof revision === 'number' && Number.isInteger(revision)) {
        runRevisions.set(runKey, revision)
      }
      await updateOfflineOperation(userId, operation.operationId, {
        status: 'synced',
        attemptCount,
        syncMessage: undefined,
      })
      for (const superseded of supersededBy.get(operation.operationId) ?? []) {
        await updateOfflineOperation(userId, superseded.operationId, {
          status: 'synced',
          syncMessage: 'Replaced by your latest offline change.',
        })
      }
      result.synced += 1
    } catch {
      result.failed += 1
      await updateOfflineOperation(userId, operation.operationId, {
        status: 'failed',
        attemptCount,
        syncMessage: 'Connection was lost before this change was confirmed.',
      })
    }
  }
  return result
}
