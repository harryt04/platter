import { z } from 'zod'
import type { DecimalString, EntityId, IsoDateTime } from './ids'

export interface MutationMetadata {
  runId?: string
  operationId: string
  clientId: string
  baseRevision?: number
}

const mutationClientStorageKey = 'platter-client-id'

/** Create retry-safe metadata for a client-originated mutation. */
export function createMutationMetadata(
  baseRevision?: number,
  runId?: string,
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
    ...(runId === undefined ? {} : { runId }),
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

export interface RealtimeRunCompletionEvent {
  type: 'run.completed'
  listId: EntityId
  runId: EntityId
  nextRunId: EntityId
  operationId: string
  completedByUserId: string
  occurredAt: IsoDateTime
}

const realtimeRunMutationEventTypes = [
  'grocery.purchased.marked',
  'grocery.purchased.undone',
  'grocery.already-have.marked',
  'grocery.already-have.undone',
  'grocery.amount-override.set',
  'grocery.amount-override.reset',
  'grocery.manual-item.added',
  'grocery.manual-item.updated',
  'grocery.manual-item.removed',
  'grocery.category.changed',
  'grocery.item.moved',
  'grocery.category.moved',
  'grocery.merge-split',
  'recipe.selection.added',
  'recipe.selection.people-changed',
  'recipe.selection.removed',
  'recipe.selection.duplicated',
  'recipe.selection.repinned',
] as const

/** Validate untrusted Socket.IO payloads before they can trigger a refresh. */
export const realtimeRunMutationEventSchema = z
  .object({
    type: z.enum(realtimeRunMutationEventTypes),
    listId: z.string().min(1),
    runId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    operationId: z.string().min(1),
    actorId: z.string().min(1),
    occurredAt: z.string().datetime(),
  })
  .strict()

export const realtimeRunCompletionEventSchema = z
  .object({
    type: z.literal('run.completed'),
    listId: z.string().min(1),
    runId: z.string().min(1),
    nextRunId: z.string().min(1),
    operationId: z.string().min(1),
    completedByUserId: z.string().min(1),
    occurredAt: z.string().datetime(),
  })
  .strict()

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
  status: 'pending' | 'syncing' | 'failed' | 'synced'
  syncMessage?: string
}

export interface GroceryAmountPreview {
  calculatedRequirement: DecimalString
  shoppingAmount: DecimalString
  hasOverride: boolean
}
