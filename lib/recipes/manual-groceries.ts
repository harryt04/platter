import { z } from 'zod'
import {
  isoDateTime,
  opaqueIdSchema,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import { selectionMutationMetadataSchema } from '@/lib/recipes/selections'
import { parseIngredientLine } from '@/lib/recipes/ingredient-parser'
import { sanitizePlainText } from '@/lib/contracts/text'
import {
  recipeIngredientSchema,
  type RecipeIngredient,
} from '@/lib/recipes/drafts'

const manualLineSchema = z
  .string({ error: 'Enter a grocery item.' })
  .transform(sanitizePlainText)
  .pipe(
    z
      .string()
      .min(1, 'Enter a grocery item.')
      .max(500, 'Grocery items must be 500 characters or fewer.'),
  )

export const createManualGroceryRequestSchema = z.object({
  line: manualLineSchema,
  ...selectionMutationMetadataSchema.shape,
})

export const updateManualGroceryRequestSchema = createManualGroceryRequestSchema

export type ManualGroceryAdditionDocument = {
  id: string
  ingredient: RecipeIngredient
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

const manualGroceryAdditionResponseSchema = z.strictObject({
  id: opaqueIdSchema,
  ingredient: recipeIngredientSchema.strict(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

/** Runtime boundary for manual-grocery mutation receipts and responses. */
export const manualGroceryMutationResponseSchema = z.union([
  z.strictObject({
    addition: manualGroceryAdditionResponseSchema,
    detail: z.string().min(1).max(500),
    code: z.enum(['MANUAL_GROCERY_ADDED', 'MANUAL_GROCERY_UPDATED']),
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({
    detail: z.string().min(1).max(500),
    code: z.literal('MANUAL_GROCERY_REMOVED'),
    additionId: opaqueIdSchema,
    revision: z.number().int().nonnegative(),
  }),
])

export type ManualGroceryMutationResponse = z.infer<
  typeof manualGroceryMutationResponseSchema
>

export type ManualGroceryMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'create' | 'update' | 'remove'
  status: 200 | 201
  response: ManualGroceryMutationResponse
}

function quantityText(quantity: { min: string; max?: string }) {
  return quantity.max ? `${quantity.min}-${quantity.max}` : quantity.min
}

/** Turn one sanitized shopping line into the same structured facts as a recipe ingredient. */
export function manualIngredientFromLine(line: string): RecipeIngredient {
  const parsed = parseIngredientLine(line)
  const ingredient = {
    originalText: parsed.originalText,
    ...(parsed.quantity ? { quantity: quantityText(parsed.quantity) } : {}),
    ...(parsed.quantity && parsed.unit.name ? { unit: parsed.unit.name } : {}),
    ingredientName: parsed.ingredientName,
    ...(parsed.normalizedIdentity
      ? { normalizedIdentity: parsed.normalizedIdentity }
      : {}),
    parserConfidence: parsed.parserConfidence,
    ...(parsed.preparationNote
      ? { preparationNote: parsed.preparationNote }
      : {}),
    optional: parsed.optional,
  }
  return recipeIngredientSchema.parse(ingredient)
}

export function createManualGroceryAdditionDocument(
  line: string,
  now = new Date(),
): ManualGroceryAdditionDocument {
  const timestamp = isoDateTime(now)
  return {
    id: crypto.randomUUID(),
    ingredient: manualIngredientFromLine(line),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function updateManualGroceryAdditionDocument(
  addition: ManualGroceryAdditionDocument,
  line: string,
  now = new Date(),
): ManualGroceryAdditionDocument {
  return {
    ...addition,
    ingredient: manualIngredientFromLine(line),
    updatedAt: isoDateTime(now),
  }
}

export function manualMutationReceiptFor(
  receipts: readonly ManualGroceryMutationReceipt[] | undefined,
  metadata: { operationId: string; clientId: string },
  kind: ManualGroceryMutationReceipt['kind'],
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
