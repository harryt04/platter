import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import {
  createListSchema,
  createListWithActiveRun,
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

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired('Sign in to view your lists.')

  const db = await getConnectedDatabase()
  const documents = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(session.user.id))
    .sort({ updatedAt: -1 })
    .toArray()

  return Response.json({ lists: documents.map(toPlatterList) })
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

  const { list, run } = await createListWithActiveRun(
    session.user.id,
    parsed.data.name,
  )
  return Response.json(
    { list: toPlatterList(list), activeRunId: run._id },
    { status: 201 },
  )
}
