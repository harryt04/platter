import { afterEach, describe, expect, it } from 'vitest'
import {
  checkRateLimit,
  resetRateLimitsForTests,
} from '@/lib/security/rate-limit'

afterEach(() => resetRateLimitsForTests())

describe('rate limiting', () => {
  it('allows a fixed number of attempts and reports the retry window', () => {
    const options = { limit: 2, windowMs: 10_000 }

    expect(checkRateLimit('actor', options, 1_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    })
    expect(checkRateLimit('actor', options, 2_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    })
    expect(checkRateLimit('actor', options, 3_000)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 8,
    })
  })

  it('resets after the window and keeps actors isolated', () => {
    const options = { limit: 1, windowMs: 1_000 }

    expect(checkRateLimit('actor-a', options, 1_000).allowed).toBe(true)
    expect(checkRateLimit('actor-a', options, 1_500).allowed).toBe(false)
    expect(checkRateLimit('actor-b', options, 1_500).allowed).toBe(true)
    expect(checkRateLimit('actor-a', options, 2_000).allowed).toBe(true)
  })
})
