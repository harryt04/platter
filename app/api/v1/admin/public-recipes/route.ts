import { getSession } from '@/lib/auth/authorization'
import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  adminPublicRecipeSearchParamsSchema,
  findAdminPublicRecipes,
} from '@/lib/admin-public-recipes'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in with an administrator account to find public recipes.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function administratorRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/administrator-required',
    title: 'Administrator access required',
    status: 403,
    detail: 'Only administrators can find public recipes.',
    code: 'ADMINISTRATOR_REQUIRED',
  })
}

function validationFailed() {
  return problemResponse({
    type: 'https://platter.dev/problems/validation-failed',
    title: 'Check the public-content search',
    status: 422,
    detail: 'Use a supported search field and a bounded search value.',
    code: 'VALIDATION_FAILED',
  })
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return authenticationRequired()
  if (session.user.role !== 'admin') return administratorRequired()

  const url = new URL(request.url)
  const parsed = adminPublicRecipeSearchParamsSchema.safeParse({
    field: url.searchParams.get('field') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return validationFailed()

  const recipes = await findAdminPublicRecipes(
    await getConnectedDatabase(),
    parsed.data,
  )
  return Response.json({ recipes })
}
