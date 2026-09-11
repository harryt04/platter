import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getAccountDeletionImpact } from '@/lib/account-deletion'
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
    return Response.json({ impact })
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/account-deletion-impact-failed',
      title: 'Deletion details unavailable',
      status: 500,
      detail: 'We couldn’t load the account deletion details. Try again.',
      code: 'ACCOUNT_DELETION_IMPACT_FAILED',
    })
  }
}
