import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'
import {
  groceryCategoryDefinitions,
  type GroceryCategory,
} from '@/lib/recipes/grocery-categories'

export const groceryCategoryOverrideRequestSchema = z.object({
  category: z.enum(
    Object.keys(groceryCategoryDefinitions) as [
      GroceryCategory,
      ...GroceryCategory[],
    ],
  ),
  ...selectionMutationMetadataSchema.shape,
})

export type GroceryCategoryOverrideDocument = {
  itemId: string
  category: GroceryCategory
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type GroceryCategoryOverrideMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'set'
  status: 200
  response: Record<string, unknown>
}

export function createGroceryCategoryOverrideDocument(
  itemId: string,
  category: GroceryCategory,
  now = new Date(),
): GroceryCategoryOverrideDocument {
  const timestamp = isoDateTime(now)
  return { itemId, category, createdAt: timestamp, updatedAt: timestamp }
}

export function groceryCategoryOverrideMutationReceiptFor(
  receipts: readonly GroceryCategoryOverrideMutationReceipt[] | undefined,
  metadata: z.infer<typeof groceryCategoryOverrideRequestSchema>,
  target: string,
) {
  const receipt = receipts?.find(
    (candidate) => candidate.operationId === metadata.operationId,
  )
  if (!receipt) return null
  if (
    receipt.clientId !== metadata.clientId ||
    receipt.kind !== 'set' ||
    receipt.target !== target
  ) {
    throw new Error('The operation id is already used for another mutation.')
  }
  return receipt
}
