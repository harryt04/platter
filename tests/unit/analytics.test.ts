import { afterEach, describe, expect, it, vi } from 'vitest'

const { environment, serverEnv, posthogCapture, PostHog } = vi.hoisted(() => {
  const environment = {
    POSTHOG_ENABLED: false,
    NEXT_PUBLIC_POSTHOG_KEY: undefined as string | undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined as string | undefined,
  }
  const posthogCapture = vi.fn()
  const PostHog = vi.fn().mockImplementation(() => ({
    capture: posthogCapture,
    shutdown: vi.fn().mockResolvedValue(undefined),
  }))
  return {
    environment,
    serverEnv: vi.fn(() => environment),
    posthogCapture,
    PostHog,
  }
})

vi.mock('@/lib/env/server', () => ({ serverEnv }))
vi.mock('posthog-node', () => ({ PostHog }))

import {
  getClientAnalytics,
  getServerAnalytics,
  getShoppingRunCompletionProperties,
  parseAnalyticsEvent,
} from '@/lib/analytics'

describe('optional analytics integration', () => {
  afterEach(() => {
    environment.POSTHOG_ENABLED = false
    environment.NEXT_PUBLIC_POSTHOG_KEY = undefined
    environment.NEXT_PUBLIC_POSTHOG_HOST = undefined
    posthogCapture.mockClear()
    PostHog.mockClear()
    vi.unstubAllGlobals()
  })

  it('stays a no-op when PostHog is not configured', async () => {
    const analytics = await getServerAnalytics()

    expect(
      analytics.capture('page_viewed', { surface: 'settings' }),
    ).toBeUndefined()
    expect(serverEnv).toHaveBeenCalledOnce()
  })

  it('keeps the server adapter a no-op when provider setup fails', async () => {
    environment.POSTHOG_ENABLED = true
    environment.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    environment.NEXT_PUBLIC_POSTHOG_HOST = 'https://analytics.example.test'
    PostHog.mockImplementationOnce(() => {
      throw new Error('provider unavailable')
    })

    const analytics = await getServerAnalytics()

    expect(analytics.capture('list_created', {})).toBeUndefined()
    expect(PostHog).toHaveBeenCalledOnce()
    expect(posthogCapture).not.toHaveBeenCalled()
  })

  it('only initializes the browser adapter with explicit valid configuration', () => {
    const init = vi.fn()
    const capture = vi.fn()
    const provider = { init, capture }
    vi.stubGlobal('window', {})

    const disabled = getClientAnalytics(
      {
        enabled: false,
        key: 'phc_test',
        host: 'https://analytics.example.test',
      },
      provider,
    )
    const missingHost = getClientAnalytics(
      { enabled: true, key: 'phc_test' },
      provider,
    )
    const invalidHost = getClientAnalytics(
      { enabled: true, key: 'phc_test', host: 'not-a-url' },
      provider,
    )

    expect(disabled.capture('list_created', {})).toBeUndefined()
    expect(missingHost.capture('list_created', {})).toBeUndefined()
    expect(invalidHost.capture('list_created', {})).toBeUndefined()
    expect(init).not.toHaveBeenCalled()

    const analytics = getClientAnalytics(
      {
        enabled: true,
        key: 'phc_test',
        host: 'https://analytics.example.test',
      },
      provider,
    )
    analytics.capture('list_created', {})
    analytics.capture('list_created', { listName: 'private' } as never)

    expect(init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://analytics.example.test',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
    })
    expect(capture).toHaveBeenCalledWith('list_created', {})
    expect(capture).toHaveBeenCalledOnce()
  })

  it('swallows provider capture failures so product actions can continue', () => {
    vi.stubGlobal('window', {})
    const provider = {
      init: vi.fn(),
      capture: vi.fn(() => {
        throw new Error('network unavailable')
      }),
    }
    const analytics = getClientAnalytics(
      {
        enabled: true,
        key: 'phc_test',
        host: 'https://analytics.example.test',
      },
      provider,
    )

    expect(() => analytics.capture('list_created', {})).not.toThrow()
  })

  it('swallows asynchronously rejected provider captures', async () => {
    vi.stubGlobal('window', {})
    const provider = {
      init: vi.fn(),
      capture: vi.fn(() => Promise.reject(new Error('network unavailable'))),
    }
    const analytics = getClientAnalytics(
      {
        enabled: true,
        key: 'phc_test',
        host: 'https://analytics.example.test',
      },
      provider,
    )

    expect(() => analytics.capture('list_created', {})).not.toThrow()
    await Promise.resolve()
    expect(provider.capture).toHaveBeenCalledOnce()
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

  it('derives the multi-recipe completion signal from the count', () => {
    expect(getShoppingRunCompletionProperties(0)).toEqual({
      recipeCount: 0,
      includedMultipleRecipes: false,
    })
    expect(getShoppingRunCompletionProperties(2)).toEqual({
      recipeCount: 2,
      includedMultipleRecipes: true,
    })
    expect(getShoppingRunCompletionProperties(1.5)).toBeNull()
    expect(
      parseAnalyticsEvent('shopping_run_completed', {
        recipeCount: 1,
        includedMultipleRecipes: true,
      }),
    ).toBeNull()
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
