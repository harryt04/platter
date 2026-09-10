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
