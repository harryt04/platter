import Decimal from 'decimal.js'
import { z } from 'zod'
import {
  decimalString,
  isoDateTime,
  type DecimalString,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

const CalculationDecimal = Decimal.clone({ precision: 40 })

export const selectionMutationMetadataSchema = z.object({
  runId: z
    .string({ error: 'Enter a shopping run id.' })
    .trim()
    .min(1, 'Enter a shopping run id.')
    .max(200, 'Shopping run ids must be 200 characters or fewer.')
    .refine(
      (value) => !/[\u0000-\u001F\u007F]/.test(value),
      'Shopping run ids cannot contain control characters.',
    ),
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

export type SelectionMutationReceipt = {
  operationId: string
  clientId: string
  target: string
  kind: 'create' | 'update-people' | 'remove' | 'duplicate' | 'repin'
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
