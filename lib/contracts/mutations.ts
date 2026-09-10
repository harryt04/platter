import type { DecimalString, EntityId, IsoDateTime } from './ids'

export interface MutationMetadata {
  operationId: string
  clientId: string
  baseRevision?: number
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
