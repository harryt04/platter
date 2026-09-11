import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  createAccountExport,
  toAccountExportSummary,
  type AccountExportDocument,
} from '@/lib/account-exports'
import { problemResponse } from '@/lib/contracts/problem'
import { checkRateLimit } from '@/lib/security/rate-limit'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to export your account data.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

export async function POST() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const rateLimit = checkRateLimit(`account-export:${session.user.id}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        type: 'https://platter.dev/problems/rate-limited',
        title: 'Export request limit reached',
        status: 429,
        detail:
          'You can request another export after the current limit resets.',
        code: 'RATE_LIMITED',
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/problem+json',
          'retry-after': String(rateLimit.retryAfterSeconds),
        },
      },
    )
  }

  try {
    const db = await getConnectedDatabase()
    const document = await createAccountExport(db, session.user)
    await db
      .collection<AccountExportDocument>('account_exports')
      .insertOne(document)
    return Response.json(
      { export: toAccountExportSummary(document) },
      { status: 201 },
    )
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/account-export-failed',
      title: 'Export could not be prepared',
      status: 500,
      detail: 'We couldn’t prepare your export. Try again.',
      code: 'ACCOUNT_EXPORT_FAILED',
    })
  }
}
