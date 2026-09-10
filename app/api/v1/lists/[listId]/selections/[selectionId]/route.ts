import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listIdSchema,
  listRoleFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import { type RecipeVersionDocument } from '@/lib/recipes/drafts'
import {
  updateRecipeSelectionDocument,
  updateRecipeSelectionSchema,
} from '@/lib/recipes/selections'
import { calculateScaledIngredients } from '@/lib/recipes/scaling'

type RouteContext = {
  params: Promise<{ listId: string; selectionId: string }>
}

const selectionIdSchema = listIdSchema

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to change a recipe selection.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function listNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-found',
    title: 'List not found',
    status: 404,
    detail: 'That list is not available to you.',
    code: 'LIST_NOT_FOUND',
  })
}

function selectionNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/selection-not-found',
    title: 'Recipe selection not found',
    status: 404,
    detail: 'That recipe is not selected in this shopping run.',
    code: 'SELECTION_NOT_FOUND',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send the number of people this recipe should feed.',
    code: 'INVALID_JSON',
  })
}

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the people count',
    status: 422,
    detail: 'Enter a positive whole number of people.',
    code: 'VALIDATION_FAILED',
    fields: { desiredPeople: ['People must be a positive whole number.'] },
  })
}

function archivedList() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-active',
    title: 'List is archived',
    status: 409,
    detail: 'Unarchive this list before changing its shopping run.',
    code: 'LIST_NOT_ACTIVE',
  })
}

function versionUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/recipe-version-unavailable',
    title: 'Recipe version unavailable',
    status: 409,
    detail:
      'The selected recipe version is no longer available to recalculate.',
    code: 'RECIPE_VERSION_UNAVAILABLE',
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, selectionId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !selectionIdSchema.safeParse(selectionId).success
  ) {
    return selectionNotFound()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }
  const parsed = updateRecipeSelectionSchema.safeParse(body)
  if (!parsed.success) return validationFailed()

  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listRoleFilter(listId, session.user.id))
  if (!list) return listNotFound()
  if (list.status !== 'active') return archivedList()

  const runs = db.collection<ShoppingRunDocument>('shopping_runs')
  const currentRun = await runs.findOne({
    _id: list.activeRunId,
    listId,
    state: 'active',
  })
  if (!currentRun) return archivedList()

  const selection = currentRun.recipeSelections.find(
    (candidate) => candidate._id === selectionId,
  )
  if (!selection) return selectionNotFound()

  const version = await db
    .collection<RecipeVersionDocument>('recipe_versions')
    .findOne({
      _id: selection.versionId,
      recipeId: selection.recipeId,
      versionNumber: selection.versionNumber,
      status: 'usable',
    })
  if (!version || !version.typicalPeopleFed) return versionUnavailable()

  if (selection.desiredPeople === parsed.data.desiredPeople) {
    return Response.json({
      selection,
      calculatedIngredients: calculateScaledIngredients(
        version.ingredients ?? [],
        selection.scaleFactor,
      ),
      revision: currentRun.revision,
    })
  }

  const updatedSelection = updateRecipeSelectionDocument(
    selection,
    parsed.data.desiredPeople,
    version.typicalPeopleFed,
  )
  const updatedRun = await runs.findOneAndUpdate(
    {
      _id: currentRun._id,
      listId,
      state: 'active',
      'recipeSelections._id': selectionId,
    },
    {
      $set: {
        'recipeSelections.$': updatedSelection,
        updatedAt: updatedSelection.updatedAt,
      },
      $inc: { revision: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!updatedRun) return selectionNotFound()

  return Response.json({
    selection: updatedSelection,
    calculatedIngredients: calculateScaledIngredients(
      version.ingredients ?? [],
      updatedSelection.scaleFactor,
    ),
    revision: updatedRun.revision,
  })
}
