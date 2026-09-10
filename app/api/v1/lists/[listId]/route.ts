import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import {
  listOwnerFilter,
  listIdSchema,
  type ListStatus,
  toPlatterList,
  updateListSchema,
  type ListDocument,
} from '@/lib/lists'
import { z } from 'zod'

type RouteContext = { params: Promise<{ listId: string }> }

const updateListStatusSchema = z.object({
  status: z.enum(['active', 'archived']),
})

function authenticationRequired(detail: string) {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail,
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

function invalidJson() {
  return problemResponse({
    type: 'https://platter.dev/problems/invalid-json',
    title: 'Invalid request',
    status: 400,
    detail: 'Send a JSON object with a list name.',
    code: 'INVALID_JSON',
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to rename a list.')

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()
  const db = await getConnectedDatabase()
  const filter = listOwnerFilter(listId, session.user.id)
  const current = await db.collection<ListDocument>('lists').findOne(filter)
  if (!current) return listNotFound()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJson()
  }

  if (typeof body === 'object' && body !== null && 'status' in body) {
    const parsedStatus = updateListStatusSchema.safeParse(body)
    if (!parsedStatus.success) {
      return problemResponse({
        type: 'https://platter.dev/problems/validation-failed',
        title: 'Check the list status',
        status: 422,
        detail: 'Choose whether the list is active or archived.',
        code: 'VALIDATION_FAILED',
        fields: { status: ['Choose active or archived.'] },
      })
    }

    const updatedAt = isoDateTime(new Date())
    const updated = await db
      .collection<ListDocument>('lists')
      .findOneAndUpdate(
        filter,
        { $set: { status: parsedStatus.data.status, updatedAt } },
        { returnDocument: 'after' },
      )
    if (!updated) return listNotFound()

    return Response.json({ list: toPlatterList(updated) })
  }

  const parsed = updateListSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check the list name',
      status: 422,
      detail: 'A list needs a name.',
      code: 'VALIDATION_FAILED',
      fields: { name: parsed.error.issues.map((issue) => issue.message) },
    })
  }

  const updatedAt = isoDateTime(new Date())
  const updated = await db
    .collection<ListDocument>('lists')
    .findOneAndUpdate(
      filter,
      { $set: { name: parsed.data.name, updatedAt } },
      { returnDocument: 'after' },
    )
  if (!updated) return listNotFound()

  return Response.json({ list: toPlatterList(updated) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to delete a list.')

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()
  const deletedAt = isoDateTime(new Date())
  const deleted = await (
    await getConnectedDatabase()
  )
    .collection<ListDocument>('lists')
    .findOneAndUpdate(
      listOwnerFilter(listId, session.user.id),
      {
        $set: { status: 'deleted' satisfies ListStatus, updatedAt: deletedAt },
      },
      { returnDocument: 'after' },
    )

  if (!deleted) return listNotFound()

  return new Response(null, { status: 204 })
}
