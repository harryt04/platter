import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  accountExportIsExpired,
  isAccountExportId,
  type AccountExportDocument,
} from '@/lib/account-exports'
import { problemResponse } from '@/lib/contracts/problem'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to download your account export.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function notFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/account-export-not-found',
    title: 'Export not found',
    status: 404,
    detail: 'That export is unavailable or has expired.',
    code: 'ACCOUNT_EXPORT_NOT_FOUND',
  })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ exportId: string }> },
) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  const { exportId } = await context.params
  if (!isAccountExportId(exportId)) return notFound()

  const db = await getConnectedDatabase()
  const document = await db
    .collection<AccountExportDocument>('account_exports')
    .findOne({ _id: exportId, userId: session.user.id })
  if (
    !document ||
    document.userId !== session.user.id ||
    accountExportIsExpired(document)
  )
    return notFound()

  return new Response(JSON.stringify(document.payload, null, 2), {
    headers: {
      'cache-control': 'no-store, private',
      'content-disposition':
        'attachment; filename="platter-account-export.json"',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  })
}
