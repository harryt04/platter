import { rateLimitProblemResponse } from '@/lib/security/rate-limit'

export function normalizeAuthRateLimitResponse(response: Response) {
  if (response.status !== 429) return response

  const retryAfterHeader =
    response.headers.get('retry-after') ??
    response.headers.get('x-retry-after') ??
    ''
  const parsedRetryAfter = Number.parseInt(retryAfterHeader, 10)
  const retryAfterSeconds =
    Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
      ? parsedRetryAfter
      : 10

  return rateLimitProblemResponse({
    type: 'https://platter.dev/problems/authentication-rate-limited',
    title: 'Authentication temporarily limited',
    detail: 'Too many authentication attempts. Wait before trying again.',
    retryAfterSeconds,
    code: 'AUTH_RATE_LIMITED',
  })
}
