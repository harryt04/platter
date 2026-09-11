import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import {
  createListResponseSchema,
  createListSchema,
  createListWithActiveRun,
  listCollectionResponseSchema,
  listMembershipFilter,
  toPlatterList,
  type ListDocument,
} from '@/lib/lists'

function authenticationRequired(detail: string) {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail,
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function listsUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/lists-unavailable',
    title: 'Lists temporarily unavailable',
    status: 503,
    detail: 'Your lists could not be loaded. Try again shortly.',
    code: 'LISTS_UNAVAILABLE',
  })
}

function listCreationUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-creation-failed',
    title: 'List creation temporarily unavailable',
    status: 503,
    detail: 'Your list could not be created. Try again shortly.',
    code: 'LIST_CREATION_FAILED',
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to view your lists.')

  try {
    const db = await getConnectedDatabase()
    const documents = await db
      .collection<ListDocument>('lists')
      .find(listMembershipFilter(session.user.id))
      .sort({ updatedAt: -1 })
      .toArray()
    const response = listCollectionResponseSchema.safeParse({
      lists: documents.map(toPlatterList),
    })
    if (!response.success) throw new Error('Invalid list collection response.')

    return Response.json(response.data)
  } catch {
    return listsUnavailable()
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to create a list.')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/invalid-json',
      title: 'Invalid request',
      status: 400,
      detail: 'Send a JSON object with a list name.',
      code: 'INVALID_JSON',
    })
  }

  const parsed = createListSchema.safeParse(body)
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

  try {
    const { list, run } = await createListWithActiveRun(
      session.user.id,
      parsed.data.name,
    )
    const response = createListResponseSchema.safeParse({
      list: toPlatterList(list),
      activeRunId: run._id,
    })
    if (!response.success) throw new Error('Invalid list creation response.')

    return Response.json(response.data, { status: 201 })
  } catch {
    return listCreationUnavailable()
  }
}
