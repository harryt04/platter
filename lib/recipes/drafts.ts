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

const optionalMetadataText = (label: string, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const cleaned = cleanText(value)
      return cleaned === '' ? undefined : cleaned
    },
    z
      .string({ error: `Enter a recipe ${label}.` })
      .max(max, `Recipe ${label} must be ${max} characters or fewer.`)
      .optional()
      .nullable(),
  )

const optionalSourceUrl = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    const cleaned = value.trim()
    return cleaned === '' ? undefined : cleaned
  },
  z
    .url({ error: 'Enter a valid source URL.' })
    .refine(
      (value) => value.startsWith('https://') || value.startsWith('http://'),
      'Source URL must use HTTP or HTTPS.',
    )
    .optional()
    .nullable(),
)

const imageUrl = z
  .string({ error: 'Enter a valid image URL.' })
  .trim()
  .max(2048, 'Image URLs must be 2,048 characters or fewer.')
  .url({ error: 'Enter a valid image URL.' })
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://'),
    'Image URL must use HTTP or HTTPS.',
  )

const recipeTimeSchema = (label: string) =>
  z
    .number({ error: `Enter a valid ${label} in minutes.` })
    .int(`${label} must be a whole number of minutes.`)
    .nonnegative(`${label} cannot be negative.`)
    .max(10080, `${label} must be 7 days or fewer.`)

const recipeLabelSchema = z
  .string({ error: 'Enter a recipe label.' })
  .transform(cleanText)
  .pipe(z.string().min(1, 'Recipe labels cannot be blank.').max(50))

const recipeLabelsSchema = z
  .array(recipeLabelSchema)
  .max(20, 'Recipes can have 20 labels or fewer.')
  .refine(
    (labels) =>
      new Set(labels.map((label) => label.toLocaleLowerCase())).size ===
      labels.length,
    'Recipe labels must be unique.',
  )

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

export const recipeMetadataSchema = z.object({
  prepTimeMinutes: recipeTimeSchema('Prep time').optional().nullable(),
  cookingTimeMinutes: recipeTimeSchema('Cooking time').optional().nullable(),
  totalTimeMinutes: recipeTimeSchema('Total time').optional().nullable(),
  cuisine: optionalMetadataText('cuisine', 100),
  mealType: optionalMetadataText('meal type', 100),
  householdNotes: optionalMetadataText('household notes', 2000),
  sourceName: optionalMetadataText('source name', 200),
  sourceUrl: optionalSourceUrl,
  sourceAuthor: optionalMetadataText('source author', 200),
  attribution: optionalMetadataText('attribution', 1000),
  tags: recipeLabelsSchema.optional(),
  dietaryLabels: recipeLabelsSchema.optional(),
})

export const recipeImageProvenanceSchema = z.object({
  url: imageUrl,
  altText: optionalMetadataText('image description', 300),
  sourceName: optionalMetadataText('image source name', 200),
  sourceUrl: optionalSourceUrl,
  creator: optionalMetadataText('image creator', 200),
  license: optionalMetadataText('image license or permission', 300),
  rightsStatus: z
    .enum(['user-owned', 'licensed', 'permission-granted', 'unknown'], {
      error: 'Choose how this image may be reused.',
    })
    .default('unknown'),
})

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>
export type RecipeInstruction = z.infer<typeof recipeInstructionSchema>
export type RecipeImageProvenance = z.infer<typeof recipeImageProvenanceSchema>

export const createDraftSchema = z.object({ title: recipeTitleSchema })
export const updateDraftSchema = z
  .object({
    title: recipeTitleSchema.optional(),
    description: recipeDescriptionSchema.nullable().optional(),
    typicalPeopleFed: typicalPeopleFedSchema.nullable().optional(),
    ...recipeMetadataSchema.shape,
    image: recipeImageProvenanceSchema.nullable().optional(),
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
  prepTimeMinutes?: number
  cookingTimeMinutes?: number
  totalTimeMinutes?: number
  cuisine?: string
  mealType?: string
  householdNotes?: string
  sourceName?: string
  sourceUrl?: string
  sourceAuthor?: string
  attribution?: string
  tags?: string[]
  dietaryLabels?: string[]
  image?: RecipeImageProvenance
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
    prepTimeMinutes?: number
    cookingTimeMinutes?: number
    totalTimeMinutes?: number
    cuisine?: string
    mealType?: string
    householdNotes?: string
    sourceName?: string
    sourceUrl?: string
    sourceAuthor?: string
    attribution?: string
    tags?: string[]
    dietaryLabels?: string[]
    image?: RecipeImageProvenance
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
    ...(details.prepTimeMinutes === undefined
      ? {}
      : { prepTimeMinutes: details.prepTimeMinutes }),
    ...(details.cookingTimeMinutes === undefined
      ? {}
      : { cookingTimeMinutes: details.cookingTimeMinutes }),
    ...(details.totalTimeMinutes === undefined
      ? {}
      : { totalTimeMinutes: details.totalTimeMinutes }),
    ...(details.cuisine === undefined ? {} : { cuisine: details.cuisine }),
    ...(details.mealType === undefined ? {} : { mealType: details.mealType }),
    ...(details.householdNotes === undefined
      ? {}
      : { householdNotes: details.householdNotes }),
    ...(details.sourceName === undefined
      ? {}
      : { sourceName: details.sourceName }),
    ...(details.sourceUrl === undefined
      ? {}
      : { sourceUrl: details.sourceUrl }),
    ...(details.sourceAuthor === undefined
      ? {}
      : { sourceAuthor: details.sourceAuthor }),
    ...(details.attribution === undefined
      ? {}
      : { attribution: details.attribution }),
    ...(details.tags === undefined ? {} : { tags: details.tags }),
    ...(details.dietaryLabels === undefined
      ? {}
      : { dietaryLabels: details.dietaryLabels }),
    ...(details.image === undefined ? {} : { image: details.image }),
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
    ...(document.prepTimeMinutes === undefined
      ? {}
      : { prepTimeMinutes: document.prepTimeMinutes }),
    ...(document.cookingTimeMinutes === undefined
      ? {}
      : { cookingTimeMinutes: document.cookingTimeMinutes }),
    ...(document.totalTimeMinutes === undefined
      ? {}
      : { totalTimeMinutes: document.totalTimeMinutes }),
    ...(document.cuisine === undefined ? {} : { cuisine: document.cuisine }),
    ...(document.mealType === undefined ? {} : { mealType: document.mealType }),
    ...(document.householdNotes === undefined
      ? {}
      : { householdNotes: document.householdNotes }),
    ...(document.sourceName === undefined
      ? {}
      : { sourceName: document.sourceName }),
    ...(document.sourceUrl === undefined
      ? {}
      : { sourceUrl: document.sourceUrl }),
    ...(document.sourceAuthor === undefined
      ? {}
      : { sourceAuthor: document.sourceAuthor }),
    ...(document.attribution === undefined
      ? {}
      : { attribution: document.attribution }),
    ...(document.tags === undefined ? {} : { tags: document.tags }),
    ...(document.dietaryLabels === undefined
      ? {}
      : { dietaryLabels: document.dietaryLabels }),
    ...(document.image === undefined ? {} : { image: document.image }),
    ingredients: document.ingredients ?? [],
    instructions: document.instructions ?? [],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}
