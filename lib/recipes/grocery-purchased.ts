import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'

export const groceryPurchasedRequestSchema = selectionMutationMetadataSchema

export type GroceryPurchasedDocument = {
  itemId: string
  markedByUserId: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type GroceryPurchasedMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'set' | 'remove'
  status: 200
  response: Record<string, unknown>
}

export function createGroceryPurchasedDocument(
  itemId: string,
  markedByUserId: string,
  now = new Date(),
): GroceryPurchasedDocument {
  const timestamp = isoDateTime(now)
  return { itemId, markedByUserId, createdAt: timestamp, updatedAt: timestamp }
}

export function groceryPurchasedMutationReceiptFor(
  receipts: readonly GroceryPurchasedMutationReceipt[] | undefined,
  metadata: z.infer<typeof groceryPurchasedRequestSchema>,
  kind: GroceryPurchasedMutationReceipt['kind'],
  target: string,
) {
  const receipt = receipts?.find(
    (candidate) => candidate.operationId === metadata.operationId,
  )
  if (!receipt) return null
  if (
    receipt.clientId !== metadata.clientId ||
    receipt.kind !== kind ||
    receipt.target !== target
  ) {
    throw new Error('The operation id is already used for another mutation.')
  }
  return receipt
}
