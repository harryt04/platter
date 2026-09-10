import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { listEditorFilter, toPlatterList, type ListDocument } from '@/lib/lists'

type RouteContext = { params: Promise<{ listId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to leave a list.',
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

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId } = await context.params
  const updated = await (
    await getConnectedDatabase()
  )
    .collection<ListDocument>('lists')
    .findOneAndUpdate(
      listEditorFilter(listId, session.user.id),
      {
        $pull: {
          members: { userId: session.user.id },
          ownerIds: session.user.id,
        },
        $set: { updatedAt: isoDateTime(new Date()) },
      },
      { returnDocument: 'after' },
    )

  if (!updated) return listNotFound()

  return Response.json({ list: toPlatterList(updated) })
}
