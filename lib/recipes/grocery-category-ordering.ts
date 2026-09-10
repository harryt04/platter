import { z } from 'zod'
import {
  groceryCategoryDefinitions,
  type GroceryCategory,
} from './grocery-categories'
import { selectionMutationMetadataSchema } from './selections'

const groceryCategorySchema = z.enum(
  Object.keys(groceryCategoryDefinitions) as [
    GroceryCategory,
    ...GroceryCategory[],
  ],
)

export const groceryCategoryOrderRequestSchema = z.object({
  category: groceryCategorySchema,
  targetCategory: groceryCategorySchema,
  placement: z.enum(['before', 'after']),
  ...selectionMutationMetadataSchema.shape,
})

export type GroceryCategoryOrderMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'move'
  status: 200
  response: Record<string, unknown>
}

export function groceryCategoryOrderMutationReceiptFor(
  receipts: readonly GroceryCategoryOrderMutationReceipt[] | undefined,
  metadata: z.infer<typeof groceryCategoryOrderRequestSchema>,
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

/** Keep current categories once in the requested order, then append defaults. */
export function currentCategoryOrder(
  savedOrder: readonly GroceryCategory[] | undefined,
  currentCategories: readonly GroceryCategory[],
) {
  const remaining = new Set(currentCategories)
  const ordered = (savedOrder ?? []).filter((category) => {
    if (!remaining.has(category)) return false
    remaining.delete(category)
    return true
  })
  return [
    ...ordered,
    ...currentCategories.filter((category) => remaining.has(category)),
  ]
}
