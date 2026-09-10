import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { isoDateTime } from '@/lib/contracts/ids'
import {
  createDraftDocument,
  createDraftSchema,
  createRecipeVersionDocument,
  recipeIngredientSchema,
  recipeInstructionSchema,
  recipeMetadataSchema,
  recipeNutritionSchema,
  recipeImageProvenanceSchema,
  typicalPeopleFedSchema,
  toRecipeDraft,
  type RecipeDraftDocument,
  type RecipeImportProvenanceDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import {
  recipeImportIdSchema,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'
import { z } from 'zod'

const importPreviewSaveSchema = z.object({
  title: createDraftSchema.shape.title,
  description: z.string().max(2000).optional().nullable(),
  typicalPeopleFed: typicalPeopleFedSchema.optional().nullable(),
  ...recipeMetadataSchema.shape,
  image: recipeImageProvenanceSchema.optional().nullable(),
  nutrition: recipeNutritionSchema.optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).max(100),
  instructions: z
    .array(recipeInstructionSchema)
    .max(100, 'Recipes can have 100 instructions or fewer.'),
})

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to save an imported recipe draft.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function notFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/import-not-found',
    title: 'Import not found',
    status: 404,
    detail: 'That import is not available to you.',
    code: 'IMPORT_NOT_FOUND',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send the corrected recipe preview as JSON.',
    code: 'INVALID_JSON',
  })
}

function notReady() {
  return problemResponse({
    type: 'https://platter.dev/problems/import-not-ready',
    title: 'Preview is not ready',
    status: 409,
    detail: 'Wait for the recipe preview before saving it.',
    code: 'IMPORT_NOT_READY',
  })
}

function createImportProvenance(
  source: RecipeImportDocument,
  importedAt: ReturnType<typeof isoDateTime>,
): RecipeImportProvenanceDocument | undefined {
  if (!source.contentFingerprint) return undefined

  const canonicalUrl = source.canonicalUrl ?? source.preview?.sourceUrl
  if (!canonicalUrl) return undefined

  let sourceDomain = source.sourceDomain
  if (!sourceDomain) {
    try {
      sourceDomain = new URL(canonicalUrl).hostname.replace(/^www\./i, '')
    } catch {
      return undefined
    }
  }

  return {
    submittedUrl: source.sourceUrl,
    canonicalUrl,
    sourceDomain,
    ...((source.sourceTitle ?? source.preview?.title)
      ? { sourceTitle: source.sourceTitle ?? source.preview?.title }
      : {}),
    ...((source.sourceAuthor ?? source.preview?.sourceAuthor)
      ? { sourceAuthor: source.sourceAuthor ?? source.preview?.sourceAuthor }
      : {}),
    importer: source.importer ?? 'schema-org-json-ld',
    importedAt,
    acquiredAt: source.acquiredAt ?? source.updatedAt,
    acquisitionMethod: source.acquisitionMethod ?? 'server-fetch',
    contentFingerprint: source.contentFingerprint,
    versionRelationship: 'source-original',
    rightsStatus: source.rightsStatus ?? 'unknown',
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ importId: string }> },
) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { importId } = await context.params
  if (!recipeImportIdSchema.safeParse(importId).success) return notFound()

  const db = await getConnectedDatabase()
  const imports = db.collection<RecipeImportDocument>('recipe_imports')
  const source = await imports.findOne({
    _id: importId,
    userId: session.user.id,
  })
  if (!source) return notFound()
  if (source.savedRecipeId) {
    return Response.json({ recipeId: source.savedRecipeId }, { status: 200 })
  }
  if (source.status !== 'preview-ready' || !source.preview) return notReady()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }
  const parsed = importPreviewSaveSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the recipe preview',
      status: 422,
      detail: 'Correct the highlighted recipe fields before saving.',
      code: 'VALIDATION_FAILED',
      fields: parsed.error.issues.reduce<Record<string, string[]>>(
        (fields, issue) => {
          const field = issue.path[0]?.toString() ?? 'recipe'
          fields[field] = [...(fields[field] ?? []), issue.message]
          return fields
        },
        {},
      ),
    })
  }

  const draft = createDraftDocument(session.user.id, parsed.data.title, {
    origin: 'imported',
    importReviewStatus: 'pending',
    typicalPeopleFed: parsed.data.typicalPeopleFed ?? undefined,
    prepTimeMinutes: parsed.data.prepTimeMinutes ?? undefined,
    cookingTimeMinutes: parsed.data.cookingTimeMinutes ?? undefined,
    totalTimeMinutes: parsed.data.totalTimeMinutes ?? undefined,
    cuisine: parsed.data.cuisine ?? undefined,
    mealType: parsed.data.mealType ?? undefined,
    sourceName: parsed.data.sourceName ?? undefined,
    sourceUrl: parsed.data.sourceUrl ?? undefined,
    sourceAuthor: parsed.data.sourceAuthor ?? undefined,
    attribution: parsed.data.attribution ?? undefined,
    tags: parsed.data.tags ?? undefined,
    dietaryLabels: parsed.data.dietaryLabels ?? undefined,
    image: parsed.data.image ?? undefined,
    nutrition: parsed.data.nutrition ?? undefined,
    importProvenance: createImportProvenance(source, isoDateTime(new Date())),
    ingredients: parsed.data.ingredients,
    instructions: parsed.data.instructions,
  })
  const claim = await imports.findOneAndUpdate(
    {
      _id: importId,
      userId: session.user.id,
      status: 'preview-ready',
      savedRecipeId: { $exists: false },
    },
    {
      $set: {
        savedRecipeId: draft._id,
        updatedAt: isoDateTime(new Date()),
      },
    },
    { returnDocument: 'after' },
  )
  if (!claim) {
    const raced = await imports.findOne({
      _id: importId,
      userId: session.user.id,
    })
    return raced?.savedRecipeId
      ? Response.json({ recipeId: raced.savedRecipeId }, { status: 200 })
      : notReady()
  }

  try {
    await db.collection<RecipeDraftDocument>('recipes').insertOne(draft)
    const version = createRecipeVersionDocument(draft)
    const { _id: versionId, ...versionContent } = version
    await db
      .collection<RecipeVersionDocument>('recipe_versions')
      .insertOne({ _id: versionId, ...versionContent })
  } catch (error) {
    await imports.updateOne(
      { _id: importId, userId: session.user.id, savedRecipeId: draft._id },
      { $unset: { savedRecipeId: '' } },
    )
    throw error
  }

  return Response.json({ recipe: toRecipeDraft(draft) }, { status: 201 })
}
