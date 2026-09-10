import type { DecimalString, EntityId, IsoDateTime } from './ids'

export interface MutationMetadata {
  operationId: string
  clientId: string
  baseRevision?: number
}

const mutationClientStorageKey = 'platter-client-id'

/** Create retry-safe metadata for a client-originated mutation. */
export function createMutationMetadata(
  baseRevision?: number,
): MutationMetadata {
  let clientId = 'server-client'
  if (typeof window !== 'undefined') {
    try {
      clientId = window.localStorage.getItem(mutationClientStorageKey) ?? ''
      if (!clientId) {
        clientId = crypto.randomUUID()
        window.localStorage.setItem(mutationClientStorageKey, clientId)
      }
    } catch {
      clientId = crypto.randomUUID()
    }
  }

  return {
    operationId: crypto.randomUUID(),
    clientId,
    ...(baseRevision === undefined ? {} : { baseRevision }),
  }
}

export interface RealtimeEvent {
  type: string
  listId: EntityId
  runId?: EntityId
  revision: number
  operationId?: string
  occurredAt: IsoDateTime
}

export interface QueuedOperation {
  operationId: string
  clientId: string
  listId: EntityId
  runId: EntityId
  kind: string
  payload: unknown
  baseRevision?: number
  createdAt: IsoDateTime
  attemptCount: number
  status: 'pending' | 'syncing' | 'failed'
}

export interface GroceryAmountPreview {
  calculatedRequirement: DecimalString
  shoppingAmount: DecimalString
  hasOverride: boolean
}
