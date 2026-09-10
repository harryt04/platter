import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'

const cleanText = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()

const recipeTitleSchema = z
  .string({ error: 'Enter a recipe title.' })
  .transform(cleanText)
  .pipe(
    z
      .string()
      .min(1, 'Enter a recipe title.')
      .max(200, 'Recipe titles must be 200 characters or fewer.'),
  )

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

const ingredientParserConfidenceSchema = z.enum(['high', 'medium', 'low'])

export const recipeOriginSchema = z.enum(['authored', 'imported'])
export const recipeImportReviewStatusSchema = z.enum([
  'not-required',
  'pending',
  'approved',
  'rejected',
])
export const recipeVisibilitySchema = z.enum([
  'private',
  'list-shared',
  'public',
  'suppressed',
])

export const recipeShareUpdateSchema = z.object({
  listIds: z
    .array(
      z
        .string({ error: 'Enter a list id.' })
        .trim()
        .min(1, 'Enter a list id.')
        .max(100, 'List ids must be 100 characters or fewer.')
        .refine(
          (value) => !/[\u0000-\u001F\u007F]/.test(value),
          'List ids cannot contain control characters.',
        ),
    )
    .max(50, 'A recipe can be shared with 50 lists or fewer.')
    .refine(
      (listIds) => new Set(listIds).size === listIds.length,
      'Choose each list only once.',
    ),
  publishPublic: z.boolean().default(false),
})

export type RecipeOrigin = z.infer<typeof recipeOriginSchema>
export type RecipeImportReviewStatus = z.infer<
  typeof recipeImportReviewStatusSchema
>
export type RecipeVisibility = z.infer<typeof recipeVisibilitySchema>

export type RecipeLineageDocument = {
  recipeId: string
  versionId: string
  versionNumber: number
}

export type RecipeLineage = {
  recipeId: EntityId
  versionId: EntityId
  versionNumber: number
}

export type RecipeShareDocument = {
  _id: string
  recipeId: string
  listId: string
  ownerId: string
  createdAt: IsoDateTime
}

export const recipeIngredientSchema = z.object({
  originalText: requiredIngredientText('line', 500),
  quantity: optionalIngredientText(50),
  unit: optionalIngredientText(50),
  ingredientName: requiredIngredientText('name', 200),
  normalizedIdentity: optionalIngredientText(200),
  parserConfidence: ingredientParserConfidenceSchema.optional(),
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

const nutritionValueSchema = (label: string, max: number) =>
  z
    .number({ error: `Enter a valid amount of ${label}.` })
    .finite(`Enter a valid amount of ${label}.`)
    .nonnegative(`${label} cannot be negative.`)
    .max(max, `${label} is outside the supported range.`)

export const recipeNutritionSchema = z
  .object({
    calories: nutritionValueSchema('calories', 100000).optional(),
    proteinGrams: nutritionValueSchema('protein', 10000).optional(),
    carbohydratesGrams: nutritionValueSchema('carbohydrates', 10000).optional(),
    fatGrams: nutritionValueSchema('fat', 10000).optional(),
    fiberGrams: nutritionValueSchema('fiber', 10000).optional(),
    sodiumMilligrams: nutritionValueSchema('sodium', 100000).optional(),
  })
  .refine(
    (nutrition) =>
      Object.values(nutrition).some((value) => value !== undefined),
    'Enter at least one nutrition value or leave nutrition blank.',
  )

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
export type RecipeNutrition = z.infer<typeof recipeNutritionSchema>

export const createDraftSchema = z.object({ title: recipeTitleSchema })
export const updateDraftSchema = z
  .object({
    title: recipeTitleSchema.optional(),
    description: recipeDescriptionSchema.nullable().optional(),
    typicalPeopleFed: typicalPeopleFedSchema.nullable().optional(),
    ...recipeMetadataSchema.shape,
    image: recipeImageProvenanceSchema.nullable().optional(),
    nutrition: recipeNutritionSchema.nullable().optional(),
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
  /** Stable identity for the dish across immutable recipe versions. */
  recipeId: EntityId
  /** Identity of the currently editable immutable version. */
  versionId: EntityId
  versionNumber: number
  ownerId: string
  title: string
  description?: string
  status: 'draft' | 'usable'
  origin: RecipeOrigin
  importReviewStatus: RecipeImportReviewStatus
  visibility: RecipeVisibility
  derivedFrom?: RecipeLineage
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
  nutrition?: RecipeNutrition
  ingredients: RecipeIngredient[]
  instructions: RecipeInstruction[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type RecipeDraftDocument = Omit<
  RecipeDraft,
  | 'id'
  | 'recipeId'
  | 'versionId'
  | 'versionNumber'
  | 'origin'
  | 'importReviewStatus'
  | 'derivedFrom'
> & {
  _id: string
  /** Stable identity is the recipe document id. Legacy documents use _id. */
  recipeId?: string
  /** Legacy documents predate explicit recipe versioning. */
  versionId?: string
  versionNumber?: number
  /** Legacy documents predate the explicit import review contract. */
  origin?: RecipeOrigin
  importReviewStatus?: RecipeImportReviewStatus
  /** A private variant's source recipe and immutable source version. */
  derivedFrom?: RecipeLineageDocument
}

/**
 * Immutable copy of a recipe version. The current recipe document is a
 * mutable pointer to the latest version; historical references use this
 * collection instead of observing later edits.
 */
export type RecipeVersionDocument = Omit<
  RecipeDraftDocument,
  '_id' | 'recipeId' | 'versionId' | 'versionNumber'
> & {
  _id: string
  recipeId: string
  versionNumber: number
}

export function recipeDrafts(collection: Collection<RecipeDraftDocument>) {
  return collection
}

export function recipeVersions(collection: Collection<RecipeVersionDocument>) {
  return collection
}

export function recipeShares(collection: Collection<RecipeShareDocument>) {
  return collection
}

export function draftOwnerFilter(ownerId: string, draftId?: string) {
  return draftId ? { _id: draftId, ownerId } : { ownerId }
}

export function ownedRecipeFilter(ownerId: string, recipeId?: string) {
  return {
    ...draftOwnerFilter(ownerId, recipeId),
    status: { $in: ['draft', 'usable'] as const },
  }
}

export function privateDraftFilter(ownerId: string, draftId?: string) {
  return {
    ...ownedRecipeFilter(ownerId, draftId),
    visibility: 'private' as const,
  }
}

export function recipeShareFilter(recipeId: string, listId?: string) {
  return listId ? { recipeId, listId } : { recipeId }
}

export function createRecipeShareDocument(
  recipeId: string,
  listId: string,
  ownerId: string,
  now = new Date(),
): RecipeShareDocument {
  return {
    _id: crypto.randomUUID(),
    recipeId,
    listId,
    ownerId,
    createdAt: isoDateTime(now),
  }
}

/**
 * Public recipe reads must use this filter so importer state cannot be
 * bypassed by a future discovery or detail query.
 */
export function publicRecipeFilter(recipeId?: string) {
  return {
    ...(recipeId ? { _id: recipeId } : {}),
    status: 'usable' as const,
    visibility: 'public' as const,
    $or: [
      { origin: { $exists: false } },
      { origin: 'authored' as const },
      { origin: 'imported' as const, importReviewStatus: 'approved' as const },
    ],
  }
}

export function isPubliclyRenderableRecipe(
  recipe: Pick<
    RecipeDraftDocument,
    'status' | 'visibility' | 'origin' | 'importReviewStatus'
  >,
) {
  return (
    recipe.status === 'usable' &&
    recipe.visibility === 'public' &&
    (recipe.origin !== 'imported' || recipe.importReviewStatus === 'approved')
  )
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
    origin?: RecipeOrigin
    importReviewStatus?: RecipeImportReviewStatus
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
    nutrition?: RecipeNutrition
    ingredients?: RecipeIngredient[]
    instructions?: RecipeInstruction[]
  } = {},
): RecipeDraftDocument {
  const now = isoDateTime(new Date())
  const ingredients = details.ingredients ?? []
  const instructions = details.instructions ?? []
  return {
    _id: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
    versionNumber: 1,
    ownerId,
    title,
    ...(details.description === undefined
      ? {}
      : { description: details.description }),
    status: isUsableRecipe(details.typicalPeopleFed, ingredients)
      ? 'usable'
      : 'draft',
    origin: details.origin ?? 'authored',
    importReviewStatus: details.importReviewStatus ?? 'not-required',
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
    ...(details.nutrition === undefined
      ? {}
      : { nutrition: details.nutrition }),
    ingredients,
    instructions,
    createdAt: now,
    updatedAt: now,
  }
}

export function createRecipeVersionDocument(
  recipe: RecipeDraftDocument,
): RecipeVersionDocument {
  const {
    _id: recipeId,
    recipeId: _legacyRecipeId,
    versionId: currentVersionId,
    versionNumber: currentVersionNumber,
    ...content
  } = recipe
  void _legacyRecipeId

  return {
    ...content,
    _id: currentVersionId ?? recipeId,
    recipeId,
    versionNumber: currentVersionNumber ?? 1,
  }
}

export function createPrivateRecipeVariantDocument(
  source: RecipeDraftDocument,
): RecipeDraftDocument {
  const {
    _id: sourceRecipeId,
    recipeId: sourceStableRecipeId,
    versionId: sourceVersionId,
    versionNumber: sourceVersionNumber,
    derivedFrom: _sourceLineage,
    createdAt: _sourceCreatedAt,
    updatedAt: _sourceUpdatedAt,
    visibility: _sourceVisibility,
    ...content
  } = source
  void _sourceLineage
  void _sourceCreatedAt
  void _sourceUpdatedAt
  void _sourceVisibility

  const now = isoDateTime(new Date())
  return {
    ...content,
    _id: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
    versionNumber: 1,
    visibility: 'private',
    derivedFrom: {
      recipeId: sourceStableRecipeId ?? sourceRecipeId,
      versionId: sourceVersionId ?? sourceRecipeId,
      versionNumber: sourceVersionNumber ?? 1,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function toRecipeDraft(document: RecipeDraftDocument): RecipeDraft {
  return {
    id: entityId(document._id),
    recipeId: entityId(document.recipeId ?? document._id),
    versionId: entityId(document.versionId ?? document._id),
    versionNumber: document.versionNumber ?? 1,
    ownerId: document.ownerId,
    title: document.title,
    ...(document.description === undefined
      ? {}
      : { description: document.description }),
    status: document.status,
    origin: document.origin ?? 'authored',
    importReviewStatus:
      document.origin === 'imported'
        ? (document.importReviewStatus ?? 'pending')
        : 'not-required',
    visibility: document.visibility,
    ...(document.derivedFrom === undefined
      ? {}
      : {
          derivedFrom: {
            recipeId: entityId(document.derivedFrom.recipeId),
            versionId: entityId(document.derivedFrom.versionId),
            versionNumber: document.derivedFrom.versionNumber,
          },
        }),
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
    ...(document.nutrition === undefined
      ? {}
      : { nutrition: document.nutrition }),
    ingredients: document.ingredients ?? [],
    instructions: document.instructions ?? [],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}
