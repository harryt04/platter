import type { PostHog } from 'posthog-node'
import { serverEnv } from '@/lib/env/server'

export const analyticsEvents = [
  'page_viewed',
  'recipe_opened',
  'shopping_run_started',
] as const
export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type SafeAnalyticsProperties = Record<
  string,
  string | number | boolean | null
>

export interface Analytics {
  capture(
    event: AnalyticsEvent,
    properties?: SafeAnalyticsProperties,
  ): void | Promise<void>
  shutdown?(): Promise<void>
}

const noop: Analytics = { capture: () => undefined }
let serverAnalytics: Analytics | undefined

export async function getServerAnalytics(): Promise<Analytics> {
  if (serverAnalytics) return serverAnalytics
  const env = serverEnv()
  if (
    !env.POSTHOG_ENABLED ||
    !env.NEXT_PUBLIC_POSTHOG_KEY ||
    !env.NEXT_PUBLIC_POSTHOG_HOST
  ) {
    serverAnalytics = noop
    return serverAnalytics
  }
  const { PostHog } = await import('posthog-node')
  const client: PostHog = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  })
  serverAnalytics = {
    capture: (event, properties) =>
      client.capture({ distinctId: 'server', event, properties }),
    shutdown: () => client.shutdown(),
  }
  return serverAnalytics
}

export function getClientAnalytics(): Analytics {
  if (typeof window === 'undefined') return noop
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return noop
  return noop
}
