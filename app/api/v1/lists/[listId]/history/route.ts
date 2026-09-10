import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { listIdSchema, findListForMember } from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import {
  decodeShoppingRunHistoryCursor,
  searchShoppingRunHistory,
} from '@/lib/shopping-run-history'
import { z } from 'zod'

type RouteContext = { params: Promise<{ listId: string }> }

const searchParamsSchema = z.object({
  cursor: z.string().max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the history search',
    status: 422,
    detail: 'Use a valid history pagination cursor and page size.',
    code: 'VALIDATION_FAILED',
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

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) {
    return problemResponse({
      type: 'https://platter.dev/problems/authentication-required',
      title: 'Authentication required',
      status: 401,
      detail: 'Sign in to view shopping history.',
      code: 'AUTHENTICATION_REQUIRED',
    })
  }

  const { listId } = await context.params
  if (!listIdSchema.safeParse(listId).success) return listNotFound()

  const url = new URL(request.url)
  const parsed = searchParamsSchema.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  })
  if (
    !parsed.success ||
    (parsed.data.cursor && !decodeShoppingRunHistoryCursor(parsed.data.cursor))
  ) {
    return validationFailed()
  }

  const list = await findListForMember(listId, session.user.id)
  if (!list) return listNotFound()

  const db = await getConnectedDatabase()
  const page = await searchShoppingRunHistory(db, list._id, parsed.data)
  return Response.json({
    history: page.entries,
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  })
}
