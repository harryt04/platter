import { afterEach, describe, expect, it, vi } from 'vitest'

const { getHandler, postHandler } = vi.hoisted(() => ({
  getHandler: vi.fn(),
  postHandler: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({ auth: {} }))
vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: getHandler,
    POST: postHandler,
  })),
}))

import { GET, POST } from '@/app/api/auth/[...all]/route'
import { normalizeAuthRateLimitResponse } from '@/lib/auth/rate-limit'

afterEach(() => vi.clearAllMocks())

describe('Better Auth route boundary', () => {
  it('translates Better Auth rate limits to the stable problem contract', async () => {
    postHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Too many requests.' }), {
        status: 429,
        headers: { 'x-retry-after': '27' },
      }),
    )

    const response = await POST(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(429)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(response.headers.get('retry-after')).toBe('27')
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/authentication-rate-limited',
      title: 'Authentication temporarily limited',
      status: 429,
      detail: 'Too many authentication attempts. Wait before trying again.',
      code: 'AUTH_RATE_LIMITED',
    })
  })

  it('uses a safe retry fallback when a provider omits its retry header', async () => {
    const response = normalizeAuthRateLimitResponse(
      new Response('provider error', { status: 429 }),
    )

    expect(response.headers.get('retry-after')).toBe('10')
    expect((await response.json()).code).toBe('AUTH_RATE_LIMITED')
  })

  it('leaves successful auth responses unchanged', async () => {
    const success = new Response(JSON.stringify({ user: { id: 'user-1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    getHandler.mockResolvedValueOnce(success)

    const response = await GET(
      new Request('http://localhost/api/auth/get-session'),
    )

    expect(response).toBe(success)
    expect(await response.json()).toEqual({ user: { id: 'user-1' } })
  })
})
