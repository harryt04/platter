import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { opaqueCursorSchema } from '@/lib/contracts/ids'
import { listIdSchema, findListForMember } from '@/lib/lists'
import { problemResponse } from '@/lib/contracts/problem'
import {
  decodeShoppingRunHistoryCursor,
  searchShoppingRunHistory,
  shoppingRunHistoryPageResponseSchema,
} from '@/lib/shopping-run-history'
import { z } from 'zod'

type RouteContext = { params: Promise<{ listId: string }> }

const searchParamsSchema = z.object({
  cursor: opaqueCursorSchema.optional(),
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

function historyUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/shopping-history-unavailable',
    title: 'Shopping history temporarily unavailable',
    status: 503,
    detail: 'Shopping history could not be loaded. Try again shortly.',
    code: 'SHOPPING_HISTORY_UNAVAILABLE',
  })
}

export async function GET(request: Request, context: RouteContext) {
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession()
  } catch {
    return historyUnavailable()
  }
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

  try {
    const list = await findListForMember(listId, session.user.id)
    if (!list) return listNotFound()

    const db = await getConnectedDatabase()
    const page = await searchShoppingRunHistory(db, list._id, parsed.data)
    const response = shoppingRunHistoryPageResponseSchema.safeParse({
      history: page.entries,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    })
    if (!response.success) return historyUnavailable()

    return Response.json(response.data)
  } catch {
    return historyUnavailable()
  }
}
