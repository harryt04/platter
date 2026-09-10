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

export interface RealtimeRunMutationEvent {
  type:
    | 'grocery.purchased.marked'
    | 'grocery.purchased.undone'
    | 'grocery.already-have.marked'
    | 'grocery.already-have.undone'
    | 'grocery.amount-override.set'
    | 'grocery.amount-override.reset'
    | 'grocery.manual-item.added'
    | 'grocery.manual-item.updated'
    | 'grocery.manual-item.removed'
    | 'grocery.category.changed'
    | 'grocery.item.moved'
    | 'grocery.category.moved'
    | 'grocery.merge-split'
    | 'recipe.selection.added'
    | 'recipe.selection.people-changed'
    | 'recipe.selection.removed'
    | 'recipe.selection.duplicated'
    | 'recipe.selection.repinned'
  listId: EntityId
  runId: EntityId
  revision: number
  operationId: string
  actorId: string
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
