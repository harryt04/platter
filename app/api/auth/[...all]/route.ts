import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth/auth'
import { normalizeAuthRateLimitResponse } from '@/lib/auth/rate-limit'

const handlers = toNextJsHandler(auth)

export async function GET(request: Request) {
  return normalizeAuthRateLimitResponse(await handlers.GET(request))
}

export async function POST(request: Request) {
  return normalizeAuthRateLimitResponse(await handlers.POST(request))
}
