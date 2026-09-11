import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/authorization'
import { auth } from '@/lib/auth/auth'
import { problemResponse } from '@/lib/contracts/problem'
import { toProfileSummary, updateProfileSchema } from '@/lib/account'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to manage your account.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  return Response.json({ account: toProfileSummary(session.user) })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/invalid-json',
      title: 'Invalid request',
      status: 400,
      detail: 'Send the profile fields you want to update as JSON.',
      code: 'INVALID_JSON',
    })
  }

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse({
      type: 'https://platter.dev/problems/validation-failed',
      title: 'Check your profile details',
      status: 422,
      detail: 'Use a supported display name or locale.',
      code: 'VALIDATION_FAILED',
      fields: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path[0] ?? 'profile',
          [issue.message],
        ]),
      ),
    })
  }

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: parsed.data,
    })
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/profile-update-failed',
      title: 'Profile update failed',
      status: 500,
      detail: 'We couldn’t save your profile. Try again.',
      code: 'PROFILE_UPDATE_FAILED',
    })
  }

  const updatedSession = await getSession()
  if (!updatedSession || updatedSession.user.id !== session.user.id) {
    return problemResponse({
      type: 'https://platter.dev/problems/profile-update-failed',
      title: 'Profile update failed',
      status: 500,
      detail: 'We couldn’t confirm your profile update. Try again.',
      code: 'PROFILE_UPDATE_FAILED',
    })
  }

  return Response.json({ account: toProfileSummary(updatedSession.user) })
}
