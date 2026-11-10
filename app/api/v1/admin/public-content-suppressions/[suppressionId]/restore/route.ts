import type { Filter } from 'mongodb'
import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'
import {
  publicContentSuppressionRecipeFilter,
  publicContentSuppressionDocumentSchema,
  publicContentSuppressionResponseSchema,
  restorePublicContentSuppression,
  suppressionIdSchema,
  toPublicContentSuppressionSummary,
  type PublicContentSuppressionAuditDocument,
  type PublicContentSuppressionDocument,
} from '@/lib/public-content-suppressions'

type RouteContext = { params: Promise<{ suppressionId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with an administrator account to restore public content.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function administratorRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/administrator-required',
    title: 'Administrator access required',
    status: 403,
    detail: 'Only administrators can restore public content.',
    code: 'ADMINISTRATOR_REQUIRED',
  })
}

function suppressionNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-content-suppression-not-found',
    title: 'Suppression not found',
    status: 404,
    detail: 'That suppression is not available to this administrator.',
    code: 'PUBLIC_CONTENT_SUPPRESSION_NOT_FOUND',
  })
}

function suppressionAlreadyRestored() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-content-suppression-already-restored',
    title: 'Suppression is already restored',
    status: 409,
    detail:
      'This suppression has already been restored and cannot be applied again.',
    code: 'PUBLIC_CONTENT_SUPPRESSION_ALREADY_RESTORED',
  })
}

function suppressionStorageUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-content-suppression-unavailable',
    title: 'Public-content suppression temporarily unavailable',
    status: 503,
    detail:
      'The public-content suppression service is temporarily unavailable. Try again shortly.',
    code: 'PUBLIC_CONTENT_SUPPRESSION_UNAVAILABLE',
  })
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (session.user.role !== 'admin') return administratorRequired()

  const { suppressionId } = await context.params
  if (!suppressionIdSchema.safeParse(suppressionId).success) {
    return suppressionNotFound()
  }

  try {
    const db = await getConnectedDatabase()
    const suppressions = db.collection<PublicContentSuppressionDocument>(
      'public_content_suppressions',
    )
    const current = await suppressions.findOne({ _id: suppressionId })
    if (!current) return suppressionNotFound()
    const parsedCurrent =
      publicContentSuppressionDocumentSchema.safeParse(current)
    if (!parsedCurrent.success) return suppressionStorageUnavailable()
    if (parsedCurrent.data.status !== 'active') {
      return suppressionAlreadyRestored()
    }

    let restored: PublicContentSuppressionDocument | null = null
    await getMongoClient().withSession(async (mongoSession) => {
      await mongoSession.withTransaction(async (transactionSession) => {
        const active = await suppressions.findOne(
          { _id: suppressionId, status: 'active' },
          { session: transactionSession },
        )
        if (!active) return
        const parsedActive =
          publicContentSuppressionDocumentSchema.safeParse(active)
        if (!parsedActive.success) throw new Error('Malformed suppression')

        const otherActive = await suppressions
          .find(
            { _id: { $ne: suppressionId }, status: 'active' },
            { session: transactionSession },
          )
          .toArray()
        const parsedOtherActive = otherActive.map((candidate) => {
          const parsed =
            publicContentSuppressionDocumentSchema.safeParse(candidate)
          if (!parsed.success) throw new Error('Malformed suppression')
          return parsed.data as PublicContentSuppressionDocument
        })
        const result = restorePublicContentSuppression(
          parsedActive.data as PublicContentSuppressionDocument,
          session.user.id,
        )
        const update = await suppressions.updateOne(
          { _id: suppressionId, status: 'active' },
          {
            $set: {
              status: result.suppression.status,
              restoredBy: result.suppression.restoredBy,
              restoredAt: result.suppression.restoredAt,
              restorationAuditId: result.suppression.restorationAuditId,
            },
          },
          { session: transactionSession },
        )
        if (update.matchedCount !== 1) return

        await db
          .collection<PublicContentSuppressionAuditDocument>(
            'public_content_suppression_audit',
          )
          .insertOne(result.audit, { session: transactionSession })

        const recipeFilters = parsedOtherActive.map(
          publicContentSuppressionRecipeFilter,
        )
        const restoreFilter: Filter<RecipeDraftDocument> = {
          $and: [
            { status: 'usable', visibility: 'suppressed' },
            publicContentSuppressionRecipeFilter(
              parsedActive.data as PublicContentSuppressionDocument,
            ),
            ...(recipeFilters.length > 0 ? [{ $nor: recipeFilters }] : []),
          ],
        }
        await db.collection<RecipeDraftDocument>('recipes').updateMany(
          restoreFilter,
          {
            $set: {
              visibility: 'public',
              updatedAt: result.suppression.restoredAt,
            },
          },
          { session: transactionSession },
        )
        restored = result.suppression
      })
    })

    if (!restored) return suppressionAlreadyRestored()
    const response = publicContentSuppressionResponseSchema.safeParse({
      suppression: toPublicContentSuppressionSummary(restored),
    })
    if (!response.success) return suppressionStorageUnavailable()
    return Response.json(response.data)
  } catch {
    return suppressionStorageUnavailable()
  }
}
