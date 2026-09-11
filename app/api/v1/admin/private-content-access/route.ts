import { getSession } from '@/lib/auth/authorization'
import {
  adminPrivateContentAccessPolicy,
  authorizeAdminPrivateContentAccess,
  recordAdminPrivateContentAccessAudit,
} from '@/lib/auth/admin-private-content-access'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with an administrator account to request private access.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function administratorRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/administrator-required',
    title: 'Administrator access required',
    status: 403,
    detail: 'Only administrators can request exceptional private access.',
    code: 'ADMINISTRATOR_REQUIRED',
  })
}

function accessDisabled() {
  return problemResponse({
    type: 'https://platter.dev/problems/private-content-access-disabled',
    title: 'Private-content access is disabled',
    status: 403,
    detail:
      'Exceptional private-content access is disabled by the instance policy.',
    code: 'PRIVATE_CONTENT_ACCESS_DISABLED',
  })
}

function invalidRequest() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-private-content-access-request',
    title: 'Check the private-access request',
    status: 422,
    detail:
      'Provide a valid target account, approved purpose, and operator case reference.',
    code: 'INVALID_PRIVATE_CONTENT_ACCESS_REQUEST',
  })
}

function auditUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/private-content-access-audit-unavailable',
    title: 'Private-access audit temporarily unavailable',
    status: 503,
    detail:
      'The private-access audit is temporarily unavailable. No access was granted. Try again shortly.',
    code: 'PRIVATE_CONTENT_ACCESS_AUDIT_UNAVAILABLE',
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
    return invalidRequest()
  }

  const decision = authorizeAdminPrivateContentAccess({
    actorId: session.user.id,
    actorRole: session.user.role,
    request: body,
    policy: adminPrivateContentAccessPolicy(),
  })
  if (!decision.allowed) {
    if (decision.code === 'PRIVATE_CONTENT_ACCESS_DISABLED') {
      return accessDisabled()
    }
    if (decision.code === 'INVALID_REQUEST') return invalidRequest()
    return administratorRequired()
  }

  try {
    await recordAdminPrivateContentAccessAudit(
      await getConnectedDatabase(),
      decision.grant,
    )
  } catch {
    return auditUnavailable()
  }

  return Response.json(
    {
      access: {
        id: decision.grant.accessId,
        purpose: decision.grant.purpose,
        caseReference: decision.grant.caseReference,
        grantedAt: decision.grant.grantedAt,
        expiresAt: decision.grant.expiresAt,
        scope: 'private-user-content',
      },
    },
    { status: 201 },
  )
}
