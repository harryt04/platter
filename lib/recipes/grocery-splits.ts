import { z } from 'zod'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'

const correctionIdSchema = z
  .string({ error: 'Enter a grocery correction id.' })
  .trim()
  .min(1, 'Enter a grocery correction id.')
  .max(200, 'Grocery correction ids must be 200 characters or fewer.')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'Grocery correction ids cannot contain control characters.',
  )

export const splitGroceryContributionRequestSchema = z.object({
  contributionId: correctionIdSchema,
  ...selectionMutationMetadataSchema.shape,
})

export type GroceryMergeSplitDocument = {
  itemId: string
  contributionId: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type GrocerySplitMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'split'
  status: 200
  response: Record<string, unknown>
}

export function createGroceryMergeSplitDocument(
  itemId: string,
  contributionId: string,
  now = new Date(),
): GroceryMergeSplitDocument {
  const timestamp = isoDateTime(now)
  return { itemId, contributionId, createdAt: timestamp, updatedAt: timestamp }
}

export function grocerySplitMutationReceiptFor(
  receipts: readonly GrocerySplitMutationReceipt[] | undefined,
  metadata: { operationId: string; clientId: string },
  target: string,
) {
  const receipt = receipts?.find(
    (candidate) => candidate.operationId === metadata.operationId,
  )
  if (!receipt) return null
  if (
    receipt.clientId !== metadata.clientId ||
    receipt.kind !== 'split' ||
    receipt.target !== target
  ) {
    throw new Error('The operation id is already used for another mutation.')
  }
  return receipt
}
