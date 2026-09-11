import { z } from 'zod'
import type { PostHog } from 'posthog-node'
import { serverEnv } from '@/lib/env/server'

const analyticsSurfaceSchema = z.enum([
  'home',
  'discover',
  'my_recipes',
  'recipe_detail',
  'shopping_run',
  'review',
  'history',
  'settings',
])

const analyticsEventSchemas = {
  page_viewed: z.strictObject({ surface: analyticsSurfaceSchema }),
  recipe_opened: z.strictObject({
    visibility: z.enum(['private', 'shared', 'public']),
  }),
  shopping_run_started: z.strictObject({
    recipeCount: z.number().int().min(0),
  }),
  list_created: z.strictObject({}),
  list_joined: z.strictObject({}),
  usable_recipe_created: z.strictObject({
    origin: z.enum(['manual', 'imported']),
  }),
  recipe_selected: z.strictObject({
    recipeCount: z.number().int().min(1),
  }),
  shopping_run_completed: z.strictObject({
    recipeCount: z.number().int().min(0),
    includedMultipleRecipes: z.boolean(),
  }),
  review_action: z.strictObject({
    action: z.enum(['already_have', 'amount_adjusted', 'amount_reset']),
  }),
  merge_correction: z.strictObject({
    action: z.enum(['merged', 'split']),
  }),
  import_outcome: z.strictObject({
    stage: z.enum(['submitted', 'reviewed', 'saved']),
    outcome: z.enum(['success', 'failure']),
  }),
  sync_reliability: z.strictObject({
    operation: z.enum(['mutation', 'reconciliation', 'realtime']),
    outcome: z.enum(['success', 'failure']),
    latency: z.enum(['under_2s', '2_to_5s', 'over_5s', 'unknown']),
  }),
  collaboration: z.strictObject({
    action: z.enum([
      'invitation_accepted',
      'member_joined',
      'member_removed',
      'ownership_transferred',
      'shared_change',
    ]),
  }),
  history_reused: z.strictObject({
    action: z.enum(['opened', 'repeated']),
  }),
} as const

export const analyticsEvents = Object.keys(analyticsEventSchemas) as Array<
  keyof typeof analyticsEventSchemas
>
export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type AnalyticsEventProperties = {
  [Event in AnalyticsEvent]: z.infer<(typeof analyticsEventSchemas)[Event]>
}
export type SafeAnalyticsProperties = AnalyticsEventProperties[AnalyticsEvent]

export interface Analytics {
  capture<Event extends AnalyticsEvent>(
    event: Event,
    properties: AnalyticsEventProperties[Event],
  ): void | Promise<void>
  shutdown?(): Promise<void>
}

type ValidatedCapture = (
  event: AnalyticsEvent,
  properties: SafeAnalyticsProperties,
) => void | Promise<void>

export function parseAnalyticsEvent(
  event: AnalyticsEvent,
  properties: unknown,
): SafeAnalyticsProperties | null {
  const schema = analyticsEventSchemas[event]
  const parsed = schema.safeParse(properties)
  return parsed.success ? parsed.data : null
}

function createValidatedAnalytics(capture: ValidatedCapture): Analytics {
  return {
    capture(event, properties) {
      const safeProperties = parseAnalyticsEvent(event, properties)
      if (!safeProperties) return undefined
      return capture(event, safeProperties)
    },
  }
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
  serverAnalytics = createValidatedAnalytics((event, properties) =>
    client.capture({ distinctId: 'server', event, properties }),
  )
  serverAnalytics.shutdown = () => client.shutdown()
  return serverAnalytics
}

export function getClientAnalytics(): Analytics {
  if (typeof window === 'undefined') return noop
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return noop
  return noop
}
