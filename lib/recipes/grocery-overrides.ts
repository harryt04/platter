import Decimal from 'decimal.js'
import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'
import type {
  GroceryAmountOverride,
  GroceryItem,
} from '@/lib/recipes/groceries'

const positiveDecimalStringSchema = z
  .string({ error: 'Enter a shopping amount.' })
  .trim()
  .regex(/^\d+(?:\.\d+)?$/, 'Enter a positive decimal amount.')
  .refine((value) => {
    const decimal = new Decimal(value)
    return decimal.isFinite() && decimal.gt(0)
  }, 'Enter a positive shopping amount.')

export const groceryAmountQuantitySchema = z
  .object({
    min: positiveDecimalStringSchema,
    max: positiveDecimalStringSchema.optional(),
  })
  .superRefine((quantity, context) => {
    if (
      quantity.max &&
      new Decimal(quantity.max).lessThan(new Decimal(quantity.min))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'The maximum must be at least the minimum.',
      })
    }
  })

export const groceryAmountOverrideRequestSchema = z.object({
  quantity: groceryAmountQuantitySchema,
  ...selectionMutationMetadataSchema.shape,
})

export type GroceryAmountOverrideDocument = GroceryAmountOverride & {
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type GroceryOverrideMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'set' | 'remove'
  status: 200
  response: Record<string, unknown>
}

export function createGroceryAmountOverrideDocument(
  item: GroceryItem,
  quantity: GroceryAmountOverride['quantity'],
  now = new Date(),
): GroceryAmountOverrideDocument {
  const timestamp = isoDateTime(now)
  return {
    itemId: item.id,
    quantity,
    preservedItem: {
      ingredientName: item.ingredientName,
      ...(item.normalizedIdentity
        ? { normalizedIdentity: item.normalizedIdentity }
        : {}),
      dimension: item.dimension,
      unit: item.unit,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function groceryOverrideMutationReceiptFor(
  receipts: readonly GroceryOverrideMutationReceipt[] | undefined,
  metadata: { operationId: string; clientId: string },
  kind: GroceryOverrideMutationReceipt['kind'],
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
