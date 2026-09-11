import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  accountDeletionImpactResponseSchema,
  getAccountDeletionImpact,
} from '@/lib/account-deletion'
import { problemResponse } from '@/lib/contracts/problem'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to review account deletion.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  try {
    const db = await getConnectedDatabase()
    const impact = await getAccountDeletionImpact(db, session.user.id)
    const response = accountDeletionImpactResponseSchema.safeParse({ impact })
    if (!response.success) throw new Error('Invalid deletion impact response.')
    return Response.json(response.data)
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/account-deletion-impact-failed',
      title: 'Deletion details temporarily unavailable',
      status: 503,
      detail:
        'We couldn’t load the account deletion details. Try again shortly.',
      code: 'ACCOUNT_DELETION_IMPACT_FAILED',
    })
  }
}
