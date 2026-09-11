import { describe, expect, it, vi } from 'vitest'

const { serverEnv } = vi.hoisted(() => ({
  serverEnv: vi.fn(() => ({
    POSTHOG_ENABLED: false,
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined,
  })),
}))

vi.mock('@/lib/env/server', () => ({ serverEnv }))

import { getServerAnalytics } from '@/lib/analytics'

describe('optional analytics integration', () => {
  it('stays a no-op when PostHog is not configured', async () => {
    const analytics = await getServerAnalytics()

    expect(
      analytics.capture('page_viewed', { route: '/settings/instance' }),
    ).toBeUndefined()
    expect(serverEnv).toHaveBeenCalledOnce()
  })
})
