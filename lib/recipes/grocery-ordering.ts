import { z } from 'zod'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'

export const groceryItemOrderRequestSchema = z.object({
  direction: z.enum(['up', 'down']),
  ...selectionMutationMetadataSchema.shape,
})

export type GroceryItemOrderMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'move'
  status: 200
  response: Record<string, unknown>
}

export function groceryItemOrderMutationReceiptFor(
  receipts: readonly GroceryItemOrderMutationReceipt[] | undefined,
  metadata: z.infer<typeof groceryItemOrderRequestSchema>,
  target: string,
) {
  const receipt = receipts?.find(
    (candidate) => candidate.operationId === metadata.operationId,
  )
  if (!receipt) return null
  if (
    receipt.clientId !== metadata.clientId ||
    receipt.kind !== 'move' ||
    receipt.target !== target
  ) {
    throw new Error('The operation id is already used for another mutation.')
  }
  return receipt
}

/** Keep generated IDs once, in the requested order, then append default IDs. */
export function currentItemOrder(
  savedOrder: readonly string[] | undefined,
  defaultItemIds: readonly string[],
) {
  const remaining = new Set(defaultItemIds)
  const ordered = (savedOrder ?? []).filter((id) => {
    if (!remaining.has(id)) return false
    remaining.delete(id)
    return true
  })
  return [...ordered, ...defaultItemIds.filter((id) => remaining.has(id))]
}
