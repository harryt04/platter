import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'

const recipeTitleSchema = z
  .string({ error: 'Enter a recipe title.' })
  .trim()
  .min(1, 'Enter a recipe title.')
  .max(200, 'Recipe titles must be 200 characters or fewer.')

const cleanText = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()

const recipeDescriptionSchema = z
  .string({ error: 'Enter a recipe description.' })
  .transform(cleanText)
  .pipe(z.string().max(2000, 'Descriptions must be 2,000 characters or fewer.'))

const requiredIngredientText = (label: string, max: number) =>
  z
    .string({ error: `Enter an ingredient ${label}.` })
    .transform(cleanText)
    .pipe(z.string().min(1, `Enter an ingredient ${label}.`).max(max))

const optionalIngredientText = (max: number) =>
  z.string().transform(cleanText).pipe(z.string().max(max)).optional()

export const recipeIngredientSchema = z.object({
  originalText: requiredIngredientText('line', 500),
  quantity: optionalIngredientText(50),
  unit: optionalIngredientText(50),
  ingredientName: requiredIngredientText('name', 200),
  preparationNote: optionalIngredientText(200),
  optional: z.boolean().default(false),
})

export const recipeInstructionSchema = z
  .string({ error: 'Enter an instruction.' })
  .transform(cleanText)
  .pipe(
    z
      .string()
      .min(1, 'Enter an instruction.')
      .max(2000, 'Instructions must be 2,000 characters or fewer.'),
  )

export const typicalPeopleFedSchema = z
  .number({ error: 'Enter how many people this recipe feeds.' })
  .int('Typical yield must be a whole number.')
  .positive('Typical yield must be greater than zero.')
  .max(1000, 'Typical yield must be 1,000 people or fewer.')

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>
export type RecipeInstruction = z.infer<typeof recipeInstructionSchema>

export const createDraftSchema = z.object({ title: recipeTitleSchema })
export const updateDraftSchema = z
  .object({
    title: recipeTitleSchema.optional(),
    description: recipeDescriptionSchema.nullable().optional(),
    typicalPeopleFed: typicalPeopleFedSchema.nullable().optional(),
    ingredients: z.array(recipeIngredientSchema).max(100).optional(),
    instructions: z
      .array(recipeInstructionSchema)
      .max(100, 'Recipes can have 100 instructions or fewer.')
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one recipe field to update.',
  })

export type RecipeDraft = {
  id: EntityId
  ownerId: string
  title: string
  description?: string
  status: 'draft' | 'usable'
  visibility: 'private'
  typicalPeopleFed?: number
  ingredients: RecipeIngredient[]
  instructions: RecipeInstruction[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type RecipeDraftDocument = Omit<RecipeDraft, 'id'> & { _id: string }

export function recipeDrafts(collection: Collection<RecipeDraftDocument>) {
  return collection
}

export function draftOwnerFilter(ownerId: string, draftId?: string) {
  return draftId ? { _id: draftId, ownerId } : { ownerId }
}

export function privateDraftFilter(ownerId: string, draftId?: string) {
  return {
    ...draftOwnerFilter(ownerId, draftId),
    status: { $in: ['draft', 'usable'] as const },
    visibility: 'private' as const,
  }
}

export function isUsableRecipe(
  typicalPeopleFed: number | undefined,
  ingredients: RecipeIngredient[] | undefined,
) {
  return (
    typeof typicalPeopleFed === 'number' &&
    Number.isInteger(typicalPeopleFed) &&
    typicalPeopleFed > 0 &&
    (ingredients?.length ?? 0) > 0
  )
}

export function createDraftDocument(
  ownerId: string,
  title: string,
  details: {
    description?: string
    typicalPeopleFed?: number
    ingredients?: RecipeIngredient[]
    instructions?: RecipeInstruction[]
  } = {},
): RecipeDraftDocument {
  const now = isoDateTime(new Date())
  const ingredients = details.ingredients ?? []
  const instructions = details.instructions ?? []
  return {
    _id: crypto.randomUUID(),
    ownerId,
    title,
    ...(details.description === undefined
      ? {}
      : { description: details.description }),
    status: isUsableRecipe(details.typicalPeopleFed, ingredients)
      ? 'usable'
      : 'draft',
    visibility: 'private',
    ...(details.typicalPeopleFed === undefined
      ? {}
      : { typicalPeopleFed: details.typicalPeopleFed }),
    ingredients,
    instructions,
    createdAt: now,
    updatedAt: now,
  }
}

export function toRecipeDraft(document: RecipeDraftDocument): RecipeDraft {
  return {
    id: entityId(document._id),
    ownerId: document.ownerId,
    title: document.title,
    ...(document.description === undefined
      ? {}
      : { description: document.description }),
    status: document.status,
    visibility: document.visibility,
    ...(document.typicalPeopleFed === undefined
      ? {}
      : { typicalPeopleFed: document.typicalPeopleFed }),
    ingredients: document.ingredients ?? [],
    instructions: document.instructions ?? [],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}
