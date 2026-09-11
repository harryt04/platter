import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  getAccountDeletionOwnershipBlockers,
  type AccountDeletionOwnershipBlocker,
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
    return Response.json({
      readiness: {
        canDelete: blockers.length === 0,
        ownershipBlockers: blockers satisfies AccountDeletionOwnershipBlocker[],
      },
    })
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/account-deletion-readiness-failed',
      title: 'Deletion readiness unavailable',
      status: 500,
      detail: 'We couldn’t check the account deletion requirements. Try again.',
      code: 'ACCOUNT_DELETION_READINESS_FAILED',
    })
  }
}
