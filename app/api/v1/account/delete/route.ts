import { headers } from 'next/headers'
import { z } from 'zod'
import { getSession } from '@/lib/auth/authorization'
import { auth } from '@/lib/auth/auth'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getAccountDeletionOwnershipBlockers } from '@/lib/account-deletion'
import { problemResponse } from '@/lib/contracts/problem'

const deleteAccountSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(200),
  })
  .strict()

function problem(code: string, title: string, detail: string, status: number) {
  return problemResponse({
    type: `https://platter.dev/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    detail,
    code,
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return problem(
      'AUTHENTICATION_REQUIRED',
      'Authentication required',
      'Sign in to delete your account.',
      401,
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problem(
      'VALIDATION_FAILED',
      'Check the confirmation details',
      'Enter your account email and password to confirm deletion.',
      422,
    )
  }
  const parsed = deleteAccountSchema.safeParse(body)
  if (
    !parsed.success ||
    parsed.data.email.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return problem(
      'CONFIRMATION_MISMATCH',
      'Confirmation did not match',
      'Enter the signed-in account email and password to confirm deletion.',
      422,
    )
  }

  const db = await getConnectedDatabase()
  const blockers = await getAccountDeletionOwnershipBlockers(
    db,
    session.user.id,
  )
  if (blockers.length > 0) {
    return problem(
      'ACCOUNT_DELETION_OWNERSHIP_BLOCKED',
      'Resolve list ownership first',
      'Transfer ownership or delete each list where you are the only owner before deleting your account.',
      409,
    )
  }

  try {
    return await auth.api.deleteUser({
      headers: await headers(),
      body: { password: parsed.data.password },
      asResponse: true,
    })
  } catch {
    return problem(
      'ACCOUNT_DELETION_FAILED',
      'Account deletion failed',
      'We couldn’t delete your account. Check your password and try again.',
      422,
    )
  }
}
