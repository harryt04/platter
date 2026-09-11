import Decimal from 'decimal.js'
import { z } from 'zod'
import {
  decimalString,
  isoDateTime,
  opaqueIdSchema,
  shoppingRunIdSchema,
  type DecimalString,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

const CalculationDecimal = Decimal.clone({ precision: 40 })

export const selectionMutationMetadataSchema = z.object({
  runId: shoppingRunIdSchema,
  operationId: z
    .string({ error: 'Enter an operation id.' })
    .trim()
    .min(1, 'Enter an operation id.')
    .max(200, 'Operation ids must be 200 characters or fewer.')
    .refine(
      (value) => !/[\u0000-\u001F\u007F]/.test(value),
      'Operation ids cannot contain control characters.',
    ),
  clientId: z
    .string({ error: 'Enter a client id.' })
    .trim()
    .min(1, 'Enter a client id.')
    .max(200, 'Client ids must be 200 characters or fewer.')
    .refine(
      (value) => !/[\u0000-\u001F\u007F]/.test(value),
      'Client ids cannot contain control characters.',
    ),
  baseRevision: z
    .number({ error: 'Base revision must be a number.' })
    .int('Base revision must be a whole number.')
    .nonnegative('Base revision cannot be negative.')
    .max(2_147_483_647, 'Base revision is too large.')
    .optional(),
})

export type SelectionMutationMetadata = z.infer<
  typeof selectionMutationMetadataSchema
>

const parsedIngredientQuantityResponseSchema = z.strictObject({
  min: z.string().min(1),
  max: z.string().min(1).optional(),
})

const scaledIngredientResponseSchema = z.strictObject({
  originalText: z.string().min(1).max(500),
  ingredientName: z.string().min(1).max(200),
  unit: z.string().min(1).max(50).optional(),
  preparationNote: z.string().min(1).max(200).optional(),
  optional: z.boolean(),
  sourceQuantity: z.string().max(50).nullable(),
  calculatedQuantity: parsedIngredientQuantityResponseSchema.nullable(),
  suggestedShoppingQuantity: parsedIngredientQuantityResponseSchema.nullable(),
})

const recipeSelectionResponseSchema = z.strictObject({
  _id: opaqueIdSchema,
  recipeId: opaqueIdSchema,
  versionId: opaqueIdSchema,
  versionNumber: z.number().int().positive(),
  desiredPeople: z.number().int().positive(),
  scaleFactor: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const selectedRecipeResponseSchema = z.strictObject({
  id: opaqueIdSchema,
  title: z.string().min(1).max(200),
  typicalPeopleFed: z.number().int().positive(),
  versionId: opaqueIdSchema,
  versionNumber: z.number().int().positive(),
})

const pinnedRecipeResponseSchema = z.strictObject({
  id: opaqueIdSchema,
  title: z.string().min(1).max(200),
  versionId: opaqueIdSchema,
  versionNumber: z.number().int().positive(),
})

const selectionCalculationResponseSchema = z.strictObject({
  selection: recipeSelectionResponseSchema,
  calculatedIngredients: z.array(scaledIngredientResponseSchema).max(100),
  revision: z.number().int().nonnegative(),
})

const selectionCreationResponseSchema =
  selectionCalculationResponseSchema.extend({
    recipe: selectedRecipeResponseSchema,
  })

const selectionRepinResponseSchema = selectionCalculationResponseSchema.extend({
  previousVersionNumber: z.number().int().positive(),
  recipe: pinnedRecipeResponseSchema,
})

const selectionRemovalResponseSchema = z.strictObject({
  detail: z.string().min(1).max(500),
  code: z.literal('SELECTION_REMOVED'),
  selectionId: opaqueIdSchema,
  revision: z.number().int().nonnegative(),
})

/** Runtime boundary for selection mutation responses and persisted replays. */
export const recipeSelectionMutationResponseSchema = z.union([
  selectionCreationResponseSchema,
  selectionRepinResponseSchema,
  selectionCalculationResponseSchema,
  selectionRemovalResponseSchema,
])

export type SelectionMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind:
    | 'create'
    | 'update-people'
    | 'remove'
    | 'duplicate'
    | 'repin'
    | 'repeat-history'
  status: 200 | 201
  response: Record<string, unknown>
}

export function selectionMutationReceiptFor(
  selectionMutationReceipts: readonly SelectionMutationReceipt[] | undefined,
  metadata: SelectionMutationMetadata,
  kind: SelectionMutationReceipt['kind'],
  target: string,
) {
  const receipt = selectionMutationReceipts?.find(
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

const recipeIdSchema = z
  .string({ error: 'Enter a recipe id.' })
  .trim()
  .min(1, 'Enter a recipe id.')
  .max(200, 'Recipe ids must be 200 characters or fewer.')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'Recipe ids cannot contain control characters.',
  )

export const createRecipeSelectionSchema = z.object({
  recipeId: recipeIdSchema,
  desiredPeople: z
    .number({ error: 'Enter how many people this recipe should feed.' })
    .int('People must be a whole number.')
    .positive('People must be greater than zero.')
    .max(1000, 'People must be 1,000 or fewer.'),
})

export const updateRecipeSelectionSchema = z.object({
  desiredPeople: createRecipeSelectionSchema.shape.desiredPeople,
})

export const createRecipeSelectionRequestSchema =
  createRecipeSelectionSchema.extend(selectionMutationMetadataSchema.shape)
export const updateRecipeSelectionRequestSchema =
  updateRecipeSelectionSchema.extend(selectionMutationMetadataSchema.shape)

export type CreateRecipeSelectionInput = z.infer<
  typeof createRecipeSelectionSchema
>

/** A selection stores the immutable recipe identity used by the active run. */
export type RecipeSelectionDocument = {
  _id: string
  recipeId: string
  versionId: string
  versionNumber: number
  desiredPeople: number
  scaleFactor: DecimalString
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export function calculateRecipeScaleFactor(
  desiredPeople: number,
  typicalPeopleFed: number,
): DecimalString {
  return decimalString(
    new CalculationDecimal(desiredPeople)
      .dividedBy(typicalPeopleFed)
      .toString(),
  )
}

export function createRecipeSelectionDocument(
  recipe: Pick<
    RecipeDraftDocument,
    '_id' | 'recipeId' | 'versionId' | 'versionNumber' | 'typicalPeopleFed'
  >,
  desiredPeople: number,
  now = new Date(),
): RecipeSelectionDocument {
  if (!recipe.typicalPeopleFed) {
    throw new Error('A recipe selection requires a typical yield.')
  }

  const timestamp = isoDateTime(now)
  return {
    _id: crypto.randomUUID(),
    recipeId: recipe.recipeId ?? recipe._id,
    versionId: recipe.versionId ?? recipe._id,
    versionNumber: recipe.versionNumber ?? 1,
    desiredPeople,
    scaleFactor: calculateRecipeScaleFactor(
      desiredPeople,
      recipe.typicalPeopleFed,
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function updateRecipeSelectionDocument(
  selection: RecipeSelectionDocument,
  desiredPeople: number,
  typicalPeopleFed: number,
  now = new Date(),
): RecipeSelectionDocument {
  if (!Number.isInteger(typicalPeopleFed) || typicalPeopleFed <= 0) {
    throw new Error('A recipe selection requires a typical yield.')
  }

  return {
    ...selection,
    desiredPeople,
    scaleFactor: calculateRecipeScaleFactor(desiredPeople, typicalPeopleFed),
    updatedAt: isoDateTime(now),
  }
}

/**
 * Repin a selection only after a member explicitly accepts a newer usable
 * version. The desired people count and selection identity stay unchanged.
 */
export function acceptNewerRecipeVersion(
  selection: RecipeSelectionDocument,
  version: Pick<
    RecipeDraftDocument,
    '_id' | 'recipeId' | 'versionNumber' | 'typicalPeopleFed'
  >,
  now = new Date(),
): RecipeSelectionDocument {
  const versionNumber = version.versionNumber ?? 1
  if (versionNumber <= selection.versionNumber) {
    throw new Error('The accepted recipe version must be newer.')
  }
  if (!version.typicalPeopleFed) {
    throw new Error('A recipe selection requires a typical yield.')
  }

  return {
    ...selection,
    recipeId: version.recipeId ?? selection.recipeId,
    versionId: version._id,
    versionNumber,
    scaleFactor: calculateRecipeScaleFactor(
      selection.desiredPeople,
      version.typicalPeopleFed,
    ),
    updatedAt: isoDateTime(now),
  }
}

/** Create an independently editable selection for the same pinned version. */
export function duplicateRecipeSelectionDocument(
  selection: RecipeSelectionDocument,
  now = new Date(),
): RecipeSelectionDocument {
  const timestamp = isoDateTime(now)
  return {
    ...selection,
    _id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Remove exactly one selection while preserving every other selection. */
export function removeRecipeSelectionDocument(
  selections: readonly RecipeSelectionDocument[],
  selectionId: string,
): RecipeSelectionDocument[] {
  return selections.filter((selection) => selection._id !== selectionId)
}
