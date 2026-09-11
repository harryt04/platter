import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import { isoDateTime } from '@/lib/contracts/ids'
import { publicCatalogImportsEnabled } from '@/lib/instance-policy'
import {
  createDraftDocument,
  createDraftSchema,
  createRecipeVersionDocument,
  recipeDescriptionSchema,
  recipeIngredientSchema,
  recipeInstructionSchema,
  recipeMetadataSchema,
  recipeNutritionSchema,
  recipeImageProvenanceSchema,
  isUsableRecipe,
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
import type { ClientSession } from 'mongodb'
import {
  findExistingPublicImportedRecipe,
  isExactImportedContent,
  isRelatedImportedContent,
} from '@/lib/recipes/import-deduplication'
import { findActivePublicContentSuppressionForImport } from '@/lib/public-content-suppressions'
import { z } from 'zod'

const importPreviewSaveSchema = z.object({
  title: createDraftSchema.shape.title,
  description: recipeDescriptionSchema.nullable().optional(),
  typicalPeopleFed: typicalPeopleFedSchema.optional().nullable(),
  ...recipeMetadataSchema.shape,
  image: recipeImageProvenanceSchema.optional().nullable(),
  nutrition: recipeNutritionSchema.optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).max(100),
  instructions: z
    .array(recipeInstructionSchema)
    .max(100, 'Recipes can have 100 instructions or fewer.'),
  acceptRelatedVersion: z.boolean().optional().default(false),
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

function publicImportsDisabled() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-imports-disabled',
    title: 'Public imports are disabled',
    status: 503,
    detail:
      'This instance has disabled new public imported recipes. Existing saved recipes remain available.',
    code: 'PUBLIC_IMPORTS_DISABLED',
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

function publicContentSuppressed() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-content-suppressed',
    title: 'Public import unavailable',
    status: 409,
    detail:
      'This source has been suppressed from public publication. It cannot be saved as a public imported recipe.',
    code: 'PUBLIC_CONTENT_SUPPRESSED',
  })
}

function duplicateImport(existingRecipe: {
  id: string
  title: string
  sourceUrl?: string
  canonicalUrl?: string
  contentFingerprint?: string
  versionId?: string
  versionNumber?: number
}) {
  return problemResponse({
    type: 'https://platter.dev/problems/import-duplicate',
    title: 'Public recipe already exists',
    status: 409,
    detail:
      'A public recipe from this source already exists. Review it before saving another imported recipe.',
    code: 'IMPORT_DUPLICATE',
    existingRecipe,
  })
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  )
}

class ImportSaveClaimLost extends Error {
  constructor() {
    super('Recipe import save was claimed by another request.')
    this.name = 'ImportSaveClaimLost'
  }
}

class PublicContentSuppressed extends Error {
  constructor() {
    super('Recipe import content is suppressed from public publication.')
    this.name = 'PublicContentSuppressed'
  }
}

function createImportProvenance(
  source: RecipeImportDocument,
  importedAt: ReturnType<typeof isoDateTime>,
  relationship: 'source-original' | 'source-update' = 'source-original',
  relatedRecipe?: {
    id: string
    versionId?: string
    versionNumber?: number
  },
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
    versionRelationship: relationship,
    ...(relatedRecipe
      ? {
          relatedRecipeId: relatedRecipe.id,
          ...(relatedRecipe.versionId
            ? { relatedVersionId: relatedRecipe.versionId }
            : {}),
          ...(relatedRecipe.versionNumber
            ? { relatedVersionNumber: relatedRecipe.versionNumber }
            : {}),
        }
      : {}),
    rightsStatus: source.rightsStatus ?? 'unknown',
    sourceAvailability: 'available',
    sourceCheckedAt: source.acquiredAt ?? importedAt,
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
  if (!publicCatalogImportsEnabled()) return publicImportsDisabled()
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

  const approvedForPublicCatalog = isUsableRecipe(
    parsed.data.typicalPeopleFed ?? undefined,
    parsed.data.ingredients,
  )
  const activeSuppression = await findActivePublicContentSuppressionForImport(
    db,
    {
      submittedUrl: source.sourceUrl,
      canonicalUrl: source.canonicalUrl,
      sourceDomain: source.sourceDomain,
      contentFingerprint: source.contentFingerprint,
    },
  )
  if (approvedForPublicCatalog && activeSuppression) {
    return publicContentSuppressed()
  }

  const existingRecipe = await findExistingPublicImportedRecipe(db, source)
  const isExactDuplicate =
    existingRecipe && isExactImportedContent(source, existingRecipe)
  const isRelatedVersion =
    existingRecipe && isRelatedImportedContent(source, existingRecipe)
  if (isExactDuplicate || (existingRecipe && !isRelatedVersion)) {
    return duplicateImport(existingRecipe)
  }
  if (isRelatedVersion && !parsed.data.acceptRelatedVersion) {
    return problemResponse({
      type: 'https://platter.dev/problems/import-related-version',
      title: 'Source has a newer recipe version',
      status: 409,
      detail:
        'This source has changed since the public recipe was imported. Confirm the related source version before saving it.',
      code: 'IMPORT_RELATED_VERSION',
      relatedRecipe: {
        id: existingRecipe.id,
        title: existingRecipe.title,
        ...(existingRecipe.sourceUrl
          ? { sourceUrl: existingRecipe.sourceUrl }
          : {}),
        versionNumber: existingRecipe.versionNumber ?? 1,
        relationship: 'source-update',
      },
    })
  }

  const draft = createDraftDocument(session.user.id, parsed.data.title, {
    origin: 'imported',
    importReviewStatus: approvedForPublicCatalog ? 'approved' : 'pending',
    visibility: approvedForPublicCatalog ? 'public' : 'private',
    description: parsed.data.description ?? undefined,
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
    importProvenance: createImportProvenance(
      source,
      isoDateTime(new Date()),
      isRelatedVersion ? 'source-update' : 'source-original',
      isRelatedVersion
        ? {
            id: existingRecipe.id,
            versionId: existingRecipe.versionId,
            versionNumber: existingRecipe.versionNumber,
          }
        : undefined,
    ),
    ingredients: parsed.data.ingredients,
    instructions: parsed.data.instructions,
  })
  try {
    await getMongoClient().withSession(async (mongoSession) => {
      await mongoSession.withTransaction(
        async (transactionSession: ClientSession) => {
          if (
            approvedForPublicCatalog &&
            (await findActivePublicContentSuppressionForImport(
              db,
              {
                submittedUrl: source.sourceUrl,
                canonicalUrl: source.canonicalUrl,
                sourceDomain: source.sourceDomain,
                contentFingerprint: source.contentFingerprint,
              },
              transactionSession,
            ))
          ) {
            throw new PublicContentSuppressed()
          }

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
            { returnDocument: 'after', session: transactionSession },
          )
          if (!claim) throw new ImportSaveClaimLost()

          await db
            .collection<RecipeDraftDocument>('recipes')
            .insertOne(draft, { session: transactionSession })
          const version = createRecipeVersionDocument(draft)
          const { _id: versionId, ...versionContent } = version
          await db
            .collection<RecipeVersionDocument>('recipe_versions')
            .insertOne(
              { _id: versionId, ...versionContent },
              { session: transactionSession },
            )
        },
      )
    })
  } catch (error) {
    if (error instanceof PublicContentSuppressed) {
      return publicContentSuppressed()
    }
    if (error instanceof ImportSaveClaimLost) {
      const raced = await imports.findOne({
        _id: importId,
        userId: session.user.id,
      })
      return raced?.savedRecipeId
        ? Response.json({ recipeId: raced.savedRecipeId }, { status: 200 })
        : notReady()
    }
    if (isDuplicateKeyError(error)) {
      const racedRecipe = await findExistingPublicImportedRecipe(db, source)
      if (racedRecipe) return duplicateImport(racedRecipe)
    }
    throw error
  }

  return Response.json({ recipe: toRecipeDraft(draft) }, { status: 201 })
}
