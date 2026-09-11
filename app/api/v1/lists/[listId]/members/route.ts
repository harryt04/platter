import { getSession, findListForRole } from '@/lib/auth/authorization'
import { listIdSchema, listMembersResponseSchema } from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'

type RouteContext = { params: Promise<{ listId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to view members for a list.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function listNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-found',
    title: 'List not found',
    status: 404,
    detail: 'That list is not available to you.',
    code: 'LIST_NOT_FOUND',
  })
}

function membersUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-members-unavailable',
    title: 'List members unavailable',
    status: 503,
    detail: 'List members are temporarily unavailable. Please try again.',
    code: 'LIST_MEMBERS_UNAVAILABLE',
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  try {
    const result = await findListForRole(listId, session.user.id, ['owner'])
    if (!result) return listNotFound()

    const response = listMembersResponseSchema.safeParse({
      members: result.list.members,
    })
    if (!response.success) return membersUnavailable()

    return Response.json(response.data)
  } catch {
    return membersUnavailable()
  }
}
