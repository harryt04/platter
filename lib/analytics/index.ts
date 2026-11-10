import { z } from 'zod'
import type { PostHog } from 'posthog-node'
import { posthog } from 'posthog-js'
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

const shoppingRunCompletedPropertiesSchema = z
  .strictObject({
    recipeCount: z.number().int().min(0),
    includedMultipleRecipes: z.boolean(),
  })
  .refine(
    ({ recipeCount, includedMultipleRecipes }) =>
      includedMultipleRecipes === recipeCount >= 2,
    'The multi-recipe signal must match the recipe count.',
  )

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
  shopping_run_completed: shoppingRunCompletedPropertiesSchema,
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

export function getShoppingRunCompletionProperties(
  recipeCount: number,
): AnalyticsEventProperties['shopping_run_completed'] | null {
  if (!Number.isInteger(recipeCount) || recipeCount < 0) return null
  return {
    recipeCount,
    includedMultipleRecipes: recipeCount >= 2,
  }
}

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

export type ClientAnalyticsConfig = {
  enabled: boolean
  key?: string
  host?: string
}

const clientAnalyticsConfigSchema = z.object({
  enabled: z.boolean(),
  key: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  host: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional(),
  ),
})

type ClientAnalyticsProvider = {
  init: (
    key: string,
    options: {
      api_host: string
      autocapture: false
      capture_pageview: false
      disable_session_recording: true
    },
  ) => unknown
  capture: (event: string, properties: SafeAnalyticsProperties) => unknown
}

function ignoreProviderResult(result: unknown): void | Promise<void> {
  if (
    !result ||
    (typeof result !== 'object' && typeof result !== 'function') ||
    typeof (result as { then?: unknown }).then !== 'function'
  ) {
    return undefined
  }
  return Promise.resolve(result).then(() => undefined)
}

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
      try {
        const result = capture(event, safeProperties)
        if (result && typeof result.catch === 'function') {
          void result.catch(() => undefined)
        }
      } catch {
        // Optional analytics must never turn a product action into a failure.
      }
      return undefined
    },
  }
}

const noop: Analytics = { capture: () => undefined }
let serverAnalytics: { signature: string; analytics: Analytics } | undefined

export async function getServerAnalytics(): Promise<Analytics> {
  const env = serverEnv()
  const signature = [
    env.POSTHOG_ENABLED,
    env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
    env.NEXT_PUBLIC_POSTHOG_HOST ?? '',
  ].join('|')
  if (serverAnalytics?.signature === signature) {
    return serverAnalytics.analytics
  }

  if (
    !env.POSTHOG_ENABLED ||
    !env.NEXT_PUBLIC_POSTHOG_KEY ||
    !env.NEXT_PUBLIC_POSTHOG_HOST
  ) {
    serverAnalytics = { signature, analytics: noop }
    return noop
  }

  try {
    const { PostHog } = await import('posthog-node')
    const client: PostHog = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
    })
    const analytics = createValidatedAnalytics((event, properties) =>
      client.capture({ distinctId: 'server', event, properties }),
    )
    analytics.shutdown = async () => {
      try {
        await client.shutdown()
      } catch {
        // A provider shutdown failure must not fail the owning process.
      }
    }
    serverAnalytics = { signature, analytics }
    return analytics
  } catch {
    serverAnalytics = { signature, analytics: noop }
    return noop
  }
}

export function getClientAnalytics(
  config?: ClientAnalyticsConfig,
  provider: ClientAnalyticsProvider = posthog,
): Analytics {
  const parsedConfig = clientAnalyticsConfigSchema.safeParse(config)
  if (
    typeof window === 'undefined' ||
    !parsedConfig.success ||
    !parsedConfig.data.enabled ||
    !parsedConfig.data.key ||
    !parsedConfig.data.host
  ) {
    return noop
  }

  try {
    provider.init(parsedConfig.data.key, {
      api_host: parsedConfig.data.host,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
    })
    return createValidatedAnalytics((event, properties) =>
      ignoreProviderResult(provider.capture(event, properties)),
    )
  } catch {
    return noop
  }
}
