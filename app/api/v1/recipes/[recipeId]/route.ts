import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import {
  createRecipeVersionDocument,
  createPrivateRecipeVariantDocument,
  isUsableRecipe,
  ownedRecipeFilter,
  publicRecipeFilter,
  recipeShares,
  recipeVersions,
  toRecipeDraft,
  updateDraftSchema,
  type RecipeDraftDocument,
  type RecipeShareDocument,
  type RecipeVersionDocument,
} from '@/lib/recipes/drafts'

type RouteContext = { params: Promise<{ recipeId: string }> }

const recipeMetadataFields = [
  'prepTimeMinutes',
  'cookingTimeMinutes',
  'totalTimeMinutes',
  'cuisine',
  'mealType',
  'householdNotes',
  'sourceName',
  'sourceUrl',
  'sourceAuthor',
  'attribution',
  'tags',
  'dietaryLabels',
] as const

async function ownedDraft(recipeId: string, ownerId: string) {
  const db = await getConnectedDatabase()
  return db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(ownedRecipeFilter(ownerId, recipeId))
}

async function sharedRecipe(recipeId: string, userId: string) {
  const db = await getConnectedDatabase()
  const memberLists = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(userId))
    .toArray()
  const listIds = memberLists.map((list) => list._id)
  if (listIds.length === 0) return null

  const share = await recipeShares(
    db.collection<RecipeShareDocument>('recipe_shares'),
  ).findOne({ recipeId, listId: { $in: listIds } })
  if (!share) return null

  return db.collection<RecipeDraftDocument>('recipes').findOne({
    _id: recipeId,
    status: 'usable',
    visibility: 'list-shared',
  })
}

async function publicRecipe(recipeId: string) {
  const db = await getConnectedDatabase()
  return db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(publicRecipeFilter(recipeId))
}

function notFoundResponse() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-not-found',
    title: 'Recipe not found',
    status: 404,
    detail: 'That recipe is not available.',
    code: 'RECIPE_NOT_FOUND',
  })
}

function authenticationRequired(detail: string) {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail,
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function invalidJson(detail = 'Send a JSON object with a recipe title.') {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail,
    code: 'INVALID_JSON',
  })
}

function invalidDraft(issues: string[], fields: Record<string, string[]>) {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the recipe details',
    status: 422,
    detail: 'Fix the highlighted recipe details and try again.',
    code: 'VALIDATION_FAILED',
    fields: fields ?? { title: issues },
  })
}

function recipeVersionConflict() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-version-conflict',
    title: 'Recipe changed elsewhere',
    status: 409,
    detail: 'This recipe changed elsewhere. Reload it before saving again.',
    code: 'RECIPE_VERSION_CONFLICT',
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const { recipeId } = await context.params
  const session = await getSession()
  if (!session) {
    const draft = await publicRecipe(recipeId)
    return draft
      ? Response.json({ recipe: toRecipeDraft(draft) })
      : authenticationRequired('Sign in to view this recipe.')
  }

  const draft =
    (await ownedDraft(recipeId, session.user.id)) ??
    (await sharedRecipe(recipeId, session.user.id))
  if (draft) return Response.json({ recipe: toRecipeDraft(draft) })

  const publicDraft = await publicRecipe(recipeId)
  return publicDraft
    ? Response.json({ recipe: toRecipeDraft(publicDraft) })
    : notFoundResponse()
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to edit your recipes.')

  const { recipeId } = await context.params
  const draft = await ownedDraft(recipeId, session.user.id)
  if (!draft) return notFoundResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = updateDraftSchema.safeParse(body)
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string[]>>(
      (result, issue) => {
        const field = issue.path[0]?.toString() ?? 'recipe'
        result[field] = [...(result[field] ?? []), issue.message]
        return result
      },
      {},
    )
    return invalidDraft(
      parsed.error.issues.map((issue) => issue.message),
      fields,
    )
  }

  const nextTypicalPeopleFed =
    'typicalPeopleFed' in parsed.data
      ? (parsed.data.typicalPeopleFed ?? undefined)
      : draft.typicalPeopleFed
  const nextIngredients =
    'ingredients' in parsed.data
      ? parsed.data.ingredients
      : (draft.ingredients ?? [])
  const status = isUsableRecipe(nextTypicalPeopleFed, nextIngredients)
  const updatedAt = isoDateTime(new Date())
  const db = await getConnectedDatabase()
  const editingPublicRecipe = draft.visibility === 'public'
  const variant = editingPublicRecipe
    ? createPrivateRecipeVariantDocument(draft)
    : null
  const setFields: Partial<RecipeDraftDocument> = {
    status: status ? 'usable' : 'draft',
    updatedAt,
    versionId: crypto.randomUUID(),
    versionNumber: editingPublicRecipe ? 1 : (draft.versionNumber ?? 1) + 1,
  }
  const unsetFields: Record<string, ''> = {}
  if ('title' in parsed.data && parsed.data.title !== undefined) {
    setFields.title = parsed.data.title
  }
  if ('description' in parsed.data) {
    if (
      parsed.data.description === null ||
      parsed.data.description === undefined ||
      parsed.data.description === ''
    ) {
      unsetFields.description = ''
    } else {
      setFields.description = parsed.data.description
    }
  }
  if ('ingredients' in parsed.data && parsed.data.ingredients !== undefined) {
    setFields.ingredients = parsed.data.ingredients
  }
  if ('instructions' in parsed.data && parsed.data.instructions !== undefined) {
    setFields.instructions = parsed.data.instructions
  }
  if ('typicalPeopleFed' in parsed.data) {
    if (parsed.data.typicalPeopleFed === null) {
      unsetFields.typicalPeopleFed = ''
    } else if (parsed.data.typicalPeopleFed !== undefined) {
      setFields.typicalPeopleFed = parsed.data.typicalPeopleFed
    }
  }
  if ('image' in parsed.data) {
    if (parsed.data.image === null || parsed.data.image === undefined) {
      unsetFields.image = ''
    } else {
      setFields.image = parsed.data.image
    }
  }
  if ('nutrition' in parsed.data) {
    if (parsed.data.nutrition === null || parsed.data.nutrition === undefined) {
      unsetFields.nutrition = ''
    } else {
      setFields.nutrition = parsed.data.nutrition
    }
  }
  for (const field of recipeMetadataFields) {
    if (!(field in parsed.data)) continue
    const value = parsed.data[field]
    if (value === null || value === undefined || value === '') {
      unsetFields[field] = ''
    } else {
      ;(setFields as Record<string, unknown>)[field] = value
    }
  }
  const previousVersion = createRecipeVersionDocument(draft)
  const { _id: previousVersionId, ...previousVersionContent } = previousVersion
  await recipeVersions(
    db.collection<RecipeVersionDocument>('recipe_versions'),
  ).updateOne(
    { _id: previousVersionId },
    { $setOnInsert: previousVersionContent },
    { upsert: true },
  )
  if (variant) {
    const updatedVariant: RecipeDraftDocument = {
      ...variant,
      ...setFields,
    }
    if (
      'typicalPeopleFed' in parsed.data &&
      parsed.data.typicalPeopleFed === null
    ) {
      delete updatedVariant.typicalPeopleFed
    }
    if (
      'description' in parsed.data &&
      (parsed.data.description === null ||
        parsed.data.description === undefined ||
        parsed.data.description === '')
    ) {
      delete updatedVariant.description
    }
    if ('image' in unsetFields) delete updatedVariant.image
    if ('nutrition' in unsetFields) delete updatedVariant.nutrition
    for (const field of recipeMetadataFields) {
      if (field in unsetFields) Reflect.deleteProperty(updatedVariant, field)
    }
    await db
      .collection<RecipeDraftDocument>('recipes')
      .insertOne(updatedVariant)
    return Response.json({ recipe: toRecipeDraft(updatedVariant) })
  }
  const updateResult = await db
    .collection<RecipeDraftDocument>('recipes')
    .updateOne(
      {
        ...ownedRecipeFilter(session.user.id, recipeId),
        ...(draft.versionId ? { versionId: draft.versionId } : {}),
      },
      {
        $set: setFields,
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
      },
    )
  if (updateResult.matchedCount !== 1) return recipeVersionConflict()

  const updatedDraft = { ...draft, ...setFields }
  if (
    'typicalPeopleFed' in parsed.data &&
    parsed.data.typicalPeopleFed === null
  ) {
    delete updatedDraft.typicalPeopleFed
  }
  if (
    'description' in parsed.data &&
    (parsed.data.description === null ||
      parsed.data.description === undefined ||
      parsed.data.description === '')
  ) {
    delete updatedDraft.description
  }
  if ('image' in unsetFields) delete updatedDraft.image
  if ('nutrition' in unsetFields) delete updatedDraft.nutrition
  for (const field of recipeMetadataFields) {
    if (field in unsetFields) Reflect.deleteProperty(updatedDraft, field)
  }
  return Response.json({
    recipe: toRecipeDraft(updatedDraft),
  })
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to delete your recipes.')

  const { recipeId } = await context.params
  const draft = await ownedDraft(recipeId, session.user.id)
  if (!draft) return notFoundResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson('Confirm the recipe title before deleting it.')
  }

  const confirmation =
    typeof body === 'object' && body !== null && 'title' in body
      ? body.title
      : undefined
  if (confirmation !== draft.title) {
    return problemResponse({
      type: 'https://platter.dev/problems/confirmation-mismatch',
      title: 'Confirmation did not match',
      status: 422,
      detail: 'Type the recipe title exactly to confirm deletion.',
      code: 'CONFIRMATION_MISMATCH',
      fields: { title: ['Type the recipe title exactly to confirm deletion.'] },
    })
  }

  const db = await getConnectedDatabase()
  const previousVersion = createRecipeVersionDocument(draft)
  const { _id: previousVersionId, ...previousVersionContent } = previousVersion
  await recipeVersions(
    db.collection<RecipeVersionDocument>('recipe_versions'),
  ).updateOne(
    { _id: previousVersionId },
    { $setOnInsert: previousVersionContent },
    { upsert: true },
  )
  await db
    .collection<RecipeDraftDocument>('recipes')
    .deleteOne(ownedRecipeFilter(session.user.id, recipeId))
  return new Response(null, { status: 204 })
}
