import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  accountDeletionReadinessResponseSchema,
  getAccountDeletionOwnershipBlockers,
} from '@/lib/account-deletion'
import { problemResponse } from '@/lib/contracts/problem'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to check whether account deletion can proceed.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  try {
    const db = await getConnectedDatabase()
    const blockers = await getAccountDeletionOwnershipBlockers(
      db,
      session.user.id,
    )
    const response = accountDeletionReadinessResponseSchema.safeParse({
      readiness: {
        canDelete: blockers.length === 0,
        ownershipBlockers: blockers,
      },
    })
    if (!response.success) {
      throw new Error('Invalid deletion readiness response.')
    }
    return Response.json(response.data)
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/account-deletion-readiness-failed',
      title: 'Deletion readiness temporarily unavailable',
      status: 503,
      detail:
        'We couldn’t check the account deletion requirements. Try again shortly.',
      code: 'ACCOUNT_DELETION_READINESS_FAILED',
    })
  }
}
