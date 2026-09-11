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

export const groceryCategoryOrderMutationResponseSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    detail: z.string().min(1).max(500),
    code: z.enum([
      'GROCERY_CATEGORY_ORDER_CHANGED',
      'GROCERY_CATEGORY_ORDER_UNCHANGED',
    ]),
  })
  .strict()

export type GroceryCategoryOrderMutationResponse = z.infer<
  typeof groceryCategoryOrderMutationResponseSchema
>

export type GroceryCategoryOrderMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'move'
  status: 200
  response: GroceryCategoryOrderMutationResponse
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
