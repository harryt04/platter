import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'

export const groceryAlreadyHaveRequestSchema = selectionMutationMetadataSchema

export type GroceryAlreadyHaveDocument = {
  itemId: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type GroceryAlreadyHaveMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'set' | 'remove'
  status: 200
  response: Record<string, unknown>
}

export function createGroceryAlreadyHaveDocument(
  itemId: string,
  now = new Date(),
): GroceryAlreadyHaveDocument {
  const timestamp = isoDateTime(now)
  return { itemId, createdAt: timestamp, updatedAt: timestamp }
}

export function groceryAlreadyHaveMutationReceiptFor(
  receipts: readonly GroceryAlreadyHaveMutationReceipt[] | undefined,
  metadata: z.infer<typeof groceryAlreadyHaveRequestSchema>,
  kind: GroceryAlreadyHaveMutationReceipt['kind'],
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
