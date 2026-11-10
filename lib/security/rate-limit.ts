import { problemResponse } from '@/lib/contracts/problem'

type RateLimitWindow = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

const windows = new Map<string, RateLimitWindow>()

function pruneExpiredWindows(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

/**
 * Apply a process-local fixed-window limit to a server action.
 *
 * The keys intentionally contain only opaque actor identifiers, never email
 * addresses or raw invitation tokens. A deployment with several web
 * processes still gets a limit per process; a shared store can replace this
 * seam later without changing route behavior.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  if (options.limit < 1 || options.windowMs < 1) {
    throw new Error('Rate-limit options must be positive.')
  }

  if (windows.size > 1000) pruneExpiredWindows(now)

  const current = windows.get(key)
  const window =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current

  window.count += 1
  windows.set(key, window)

  const allowed = window.count <= options.limit
  return {
    allowed,
    remaining: Math.max(0, options.limit - window.count),
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  }
}

export function rateLimitProblemResponse(input: {
  title: string
  detail: string
  retryAfterSeconds: number
  code?: string
  type?: string
}) {
  const response = problemResponse({
    type: input.type ?? 'https://platter.dev/problems/rate-limited',
    title: input.title,
    status: 429,
    detail: input.detail,
    code: input.code ?? 'RATE_LIMITED',
  })
  response.headers.set('retry-after', String(input.retryAfterSeconds))
  return response
}

export function resetRateLimitsForTests() {
  windows.clear()
}
