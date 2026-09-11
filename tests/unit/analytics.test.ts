import { describe, expect, it, vi } from 'vitest'

const { serverEnv } = vi.hoisted(() => ({
  serverEnv: vi.fn(() => ({
    POSTHOG_ENABLED: false,
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined,
  })),
}))

vi.mock('@/lib/env/server', () => ({ serverEnv }))

import { getServerAnalytics, parseAnalyticsEvent } from '@/lib/analytics'

describe('optional analytics integration', () => {
  it('stays a no-op when PostHog is not configured', async () => {
    const analytics = await getServerAnalytics()

    expect(
      analytics.capture('page_viewed', { surface: 'settings' }),
    ).toBeUndefined()
    expect(serverEnv).toHaveBeenCalledOnce()
  })

  it('defines typed, content-free events for the core product funnel', () => {
    expect(
      parseAnalyticsEvent('shopping_run_completed', {
        recipeCount: 2,
        includedMultipleRecipes: true,
      }),
    ).toEqual({ recipeCount: 2, includedMultipleRecipes: true })
    expect(
      parseAnalyticsEvent('import_outcome', {
        stage: 'saved',
        outcome: 'success',
      }),
    ).toEqual({ stage: 'saved', outcome: 'success' })
    expect(
      parseAnalyticsEvent('collaboration', { action: 'member_joined' }),
    ).toEqual({ action: 'member_joined' })
  })

  it('rejects unknown properties and content-bearing values at the event boundary', () => {
    expect(
      parseAnalyticsEvent('list_created', { listName: 'Tuesday dinner' }),
    ).toBeNull()
    expect(
      parseAnalyticsEvent('recipe_opened', {
        visibility: 'public',
        recipeTitle: 'Pasta',
      }),
    ).toBeNull()
    expect(
      parseAnalyticsEvent('import_outcome', {
        stage: 'saved',
        outcome: 'success',
        sourceUrl: 'https://example.test/recipe',
      }),
    ).toBeNull()
  })
})
