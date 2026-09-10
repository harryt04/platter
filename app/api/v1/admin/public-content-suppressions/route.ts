import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'
import {
  createPublicContentSuppression,
  createPublicContentSuppressionSchema,
  findActivePublicContentSuppression,
  normalizePublicContentSuppressionTarget,
  toPublicContentSuppressionSummary,
  validatePublicContentSuppressionInput,
  type PublicContentSuppressionDocument,
  type PublicContentSuppressionAuditDocument,
} from '@/lib/public-content-suppressions'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with an administrator account to suppress public content.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function administratorRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/administrator-required',
    title: 'Administrator access required',
    status: 403,
    detail: 'Only administrators can suppress public content.',
    code: 'ADMINISTRATOR_REQUIRED',
  })
}

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid suppression request',
    status: 400,
    detail: 'Send a JSON object containing the target and a reason.',
    code: 'INVALID_JSON',
  })
}

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the suppression request',
    status: 422,
    detail: 'Choose a supported target and provide a bounded reason.',
    code: 'VALIDATION_FAILED',
  })
}

function targetNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-content-not-found',
    title: 'Public content not found',
    status: 404,
    detail: 'That public content is not available for moderation.',
    code: 'PUBLIC_CONTENT_NOT_FOUND',
  })
}

function alreadySuppressed() {
  return problemResponse({
    type: 'https://platter.dev/problems/public-content-already-suppressed',
    title: 'Public content is already suppressed',
    status: 409,
    detail: 'An active suppression already exists for that target.',
    code: 'PUBLIC_CONTENT_ALREADY_SUPPRESSED',
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (session.user.role !== 'admin') return administratorRequired()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  const parsed = createPublicContentSuppressionSchema.safeParse(body)
  if (!parsed.success || !validatePublicContentSuppressionInput(parsed.data)) {
    return validationFailed()
  }

  let target: string
  try {
    target = normalizePublicContentSuppressionTarget(
      parsed.data.targetType,
      parsed.data.target,
    )
  } catch {
    return validationFailed()
  }

  const db = await getConnectedDatabase()
  if (parsed.data.targetType === 'recipe') {
    const recipe = await db.collection<RecipeDraftDocument>('recipes').findOne({
      _id: target,
      status: 'usable',
      visibility: { $in: ['public', 'suppressed'] },
    })
    if (!recipe) return targetNotFound()
  }

  if (
    await findActivePublicContentSuppression(db, parsed.data.targetType, target)
  ) {
    return alreadySuppressed()
  }

  const { suppression, audit } = createPublicContentSuppression(
    { ...parsed.data, target },
    session.user.id,
  )

  await getMongoClient().withSession(async (mongoSession) => {
    await mongoSession.withTransaction(async (transactionSession) => {
      await db
        .collection<PublicContentSuppressionDocument>(
          'public_content_suppressions',
        )
        .insertOne(suppression, { session: transactionSession })
      await db
        .collection<PublicContentSuppressionAuditDocument>(
          'public_content_suppression_audit',
        )
        .insertOne(audit, { session: transactionSession })
      if (suppression.targetType === 'recipe') {
        await db.collection<RecipeDraftDocument>('recipes').updateOne(
          { _id: suppression.target },
          {
            $set: {
              visibility: 'suppressed',
              updatedAt: suppression.createdAt,
            },
          },
          { session: transactionSession },
        )
      }
    })
  })

  return Response.json(
    { suppression: toPublicContentSuppressionSummary(suppression) },
    { status: 201 },
  )
}
