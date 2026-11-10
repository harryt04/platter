import { serverEnv, type ServerEnv } from '@/lib/env/server'
import { parseDisabledRecipeImportAdapters } from '@/lib/recipe-import-adapters'

export type InstanceServiceStatus = 'enabled' | 'disabled' | 'incomplete'

export type InstanceServiceSummary = {
  id:
    | 'email'
    | 'analytics'
    | 'public-catalog'
    | 'dmca'
    | 'importer'
    | 'moderation'
    | 'source-adapters'
  label: string
  status: InstanceServiceStatus
  statusLabel: string
  detail: string
  optionalIntegration?: {
    licensing: string
    cost: string
    dataSharing: string
  }
}

export type InstancePolicySummary = {
  services: InstanceServiceSummary[]
}

type PublicCatalogPolicyEnvironment = Pick<
  ServerEnv,
  | 'NODE_ENV'
  | 'PUBLIC_CATALOG_POLICIES_PUBLISHED'
  | 'PUBLIC_CATALOG_TERMS_URL'
  | 'PUBLIC_CATALOG_PRIVACY_URL'
  | 'PUBLIC_CATALOG_REMOVAL_CONTACT'
  | 'PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL'
  | 'PUBLIC_CATALOG_DMCA_AGENT_NAME'
  | 'PUBLIC_CATALOG_DMCA_AGENT_CONTACT'
  | 'PUBLIC_CATALOG_DMCA_NOTICE_URL'
  | 'PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL'
>

type InstancePolicyEnvironment = Pick<
  ServerEnv,
  | 'SMTP_ENABLED'
  | 'SMTP_HOST'
  | 'SMTP_FROM'
  | 'POSTHOG_ENABLED'
  | 'NEXT_PUBLIC_POSTHOG_KEY'
  | 'NEXT_PUBLIC_POSTHOG_HOST'
  | 'RECIPE_IMPORTS_ENABLED'
  | 'RECIPE_IMPORT_DISABLED_ADAPTERS'
> &
  PublicCatalogPolicyEnvironment

const builtInImporterIds = ['schema-org-json-ld', 'generic-html'] as const

export function publicCatalogPolicyIsReady(
  environment: PublicCatalogPolicyEnvironment,
) {
  return Boolean(
    environment.PUBLIC_CATALOG_POLICIES_PUBLISHED &&
    environment.PUBLIC_CATALOG_TERMS_URL &&
    environment.PUBLIC_CATALOG_PRIVACY_URL &&
    environment.PUBLIC_CATALOG_REMOVAL_CONTACT &&
    environment.PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL,
  )
}

export function publicCatalogDmcaPolicyIsReady(
  environment: PublicCatalogPolicyEnvironment,
) {
  return Boolean(
    environment.PUBLIC_CATALOG_DMCA_AGENT_NAME &&
    environment.PUBLIC_CATALOG_DMCA_AGENT_CONTACT &&
    environment.PUBLIC_CATALOG_DMCA_NOTICE_URL &&
    environment.PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL,
  )
}

export function publicCatalogImportsEnabled(
  environment: Pick<ServerEnv, 'NODE_ENV' | 'RECIPE_IMPORTS_ENABLED'> &
    PublicCatalogPolicyEnvironment = serverEnv(),
) {
  if (!environment.RECIPE_IMPORTS_ENABLED) return false

  // Local and test instances may exercise the import workflow without
  // pretending that their policies are published for a hosted deployment.
  return (
    environment.NODE_ENV !== 'production' ||
    publicCatalogPolicyIsReady(environment)
  )
}

function configuredEmailStatus(env: InstancePolicyEnvironment) {
  if (!env.SMTP_ENABLED) {
    return {
      status: 'disabled' as const,
      statusLabel: 'Disabled',
      detail: 'Invitation and password-reset email delivery is turned off.',
      optionalIntegration: {
        licensing:
          "The configured SMTP provider's terms and license apply; Platter only supplies the mail adapter.",
        cost: 'Platter does not charge for email delivery. The configured SMTP provider may charge separately.',
        dataSharing:
          'When enabled, recipient addresses and invitation or password-reset message content are sent to the configured SMTP host.',
      },
    }
  }

  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    return {
      status: 'incomplete' as const,
      statusLabel: 'Incomplete',
      detail: 'SMTP is enabled but its host or sender address is missing.',
      optionalIntegration: {
        licensing:
          "The configured SMTP provider's terms and license apply; Platter only supplies the mail adapter.",
        cost: 'Platter does not charge for email delivery. The configured SMTP provider may charge separately.',
        dataSharing:
          'Email delivery is a no-op until a complete SMTP host and sender address are configured.',
      },
    }
  }

  return {
    status: 'enabled' as const,
    statusLabel: 'Enabled',
    detail: `Delivery is enabled through ${env.SMTP_HOST}.`,
    optionalIntegration: {
      licensing:
        "The configured SMTP provider's terms and license apply; Platter only supplies the mail adapter.",
      cost: 'Platter does not charge for email delivery. The configured SMTP provider may charge separately.',
      dataSharing:
        'Recipient addresses and invitation or password-reset message content are sent to the configured SMTP host.',
    },
  }
}

function configuredAnalyticsStatus(env: InstancePolicyEnvironment) {
  if (!env.POSTHOG_ENABLED) {
    return {
      status: 'disabled' as const,
      statusLabel: 'Disabled',
      detail: 'Analytics remains a typed no-op until an operator opts in.',
      optionalIntegration: {
        licensing:
          "PostHog's license and service terms apply only if an operator chooses to configure it.",
        cost: 'Platter does not require paid analytics. Hosted PostHog plans or self-hosting have their own costs.',
        dataSharing:
          'No analytics data is sent while this integration is disabled.',
      },
    }
  }

  if (!env.NEXT_PUBLIC_POSTHOG_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST) {
    return {
      status: 'incomplete' as const,
      statusLabel: 'Incomplete',
      detail: 'Analytics is opted in but its provider key or host is missing.',
      optionalIntegration: {
        licensing:
          "PostHog's license and service terms apply only if an operator chooses to configure it.",
        cost: 'Platter does not require paid analytics. Hosted PostHog plans or self-hosting have their own costs.',
        dataSharing:
          'Analytics remains a typed no-op until both the provider key and host are configured.',
      },
    }
  }

  return {
    status: 'enabled' as const,
    statusLabel: 'Enabled',
    detail: 'Only allowlisted, content-free product events are eligible.',
    optionalIntegration: {
      licensing:
        "PostHog's license and service terms apply; the integration is optional.",
      cost: 'Platter does not require paid analytics. Hosted PostHog plans or self-hosting have their own costs.',
      dataSharing:
        'Only allowlisted, content-free product events are sent; recipe, ingredient, grocery, URL, contact, and secret values are excluded.',
    },
  }
}

function configuredDmcaStatus(env: InstancePolicyEnvironment) {
  const configuredFields = [
    env.PUBLIC_CATALOG_DMCA_AGENT_NAME,
    env.PUBLIC_CATALOG_DMCA_AGENT_CONTACT,
    env.PUBLIC_CATALOG_DMCA_NOTICE_URL,
    env.PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL,
  ]
  const configured = configuredFields.filter(Boolean).length

  if (configured === 0) {
    return {
      status: 'disabled' as const,
      statusLabel: 'Not configured',
      detail:
        'Optional DMCA agent and notice or counter-notice information is not configured.',
    }
  }

  if (!publicCatalogDmcaPolicyIsReady(env)) {
    return {
      status: 'incomplete' as const,
      statusLabel: 'Incomplete',
      detail:
        'Complete the optional agent, contact, notice, and counter-notice settings together.',
    }
  }

  return {
    status: 'enabled' as const,
    statusLabel: 'Configured',
    detail:
      'The configured public page can identify the designated agent and notice process.',
  }
}

export function getInstancePolicySummary(
  environment: InstancePolicyEnvironment = serverEnv(),
): InstancePolicySummary {
  const disabledImporters = new Set(
    parseDisabledRecipeImportAdapters(
      environment.RECIPE_IMPORT_DISABLED_ADAPTERS,
    ),
  )
  const activeImporters = builtInImporterIds.filter(
    (adapterId) => !disabledImporters.has(adapterId),
  )
  const email = configuredEmailStatus(environment)
  const analytics = configuredAnalyticsStatus(environment)
  const dmca = configuredDmcaStatus(environment)
  const policyReady = publicCatalogPolicyIsReady(environment)
  const hosted = environment.NODE_ENV === 'production'

  return {
    services: [
      {
        id: 'email',
        label: 'Email delivery',
        ...email,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        ...analytics,
      },
      {
        id: 'public-catalog',
        label: 'Public catalog',
        status: !environment.RECIPE_IMPORTS_ENABLED
          ? 'disabled'
          : hosted && !policyReady
            ? 'incomplete'
            : 'enabled',
        statusLabel: !environment.RECIPE_IMPORTS_ENABLED
          ? 'Disabled'
          : hosted && !policyReady
            ? 'Policy required'
            : hosted
              ? 'Enabled'
              : 'Development only',
        detail: !environment.RECIPE_IMPORTS_ENABLED
          ? 'New public URL imports are disabled; manual recipes, existing saved recipes, and shopping remain available.'
          : hosted && !policyReady
            ? 'Hosted public imports stay disabled until terms, privacy, removal contact, and repeat-infringer handling are published and configured.'
            : hosted
              ? 'Required hosted policies are published; new public URL imports are available.'
              : 'Public URL imports are available for local development; hosted enablement still requires the published policy configuration.',
      },
      {
        id: 'dmca',
        label: 'Optional DMCA process',
        ...dmca,
      },
      {
        id: 'importer',
        label: 'Recipe importer',
        status: activeImporters.length > 0 ? 'enabled' : 'disabled',
        statusLabel: activeImporters.length > 0 ? 'Available' : 'Disabled',
        detail:
          activeImporters.length > 0
            ? `${activeImporters.length} built-in adapter${activeImporters.length === 1 ? '' : 's'} available for reviewable imports.`
            : 'All built-in adapters are disabled; manual recipes continue to work.',
        optionalIntegration: {
          licensing:
            'Built-in adapters are included with Platter; source and site terms still govern fetched content.',
          cost: 'No paid recipe API is required. The operator remains responsible for ordinary hosting and network costs.',
          dataSharing:
            'Submitted URLs are fetched by this instance; no external importer service is required.',
        },
      },
      {
        id: 'moderation',
        label: 'Moderation',
        status: 'enabled',
        statusLabel: 'Available',
        detail:
          'Administrator complaint and public-content suppression workflows are available.',
      },
      {
        id: 'source-adapters',
        label: 'Source adapters',
        status: 'disabled',
        statusLabel: 'None configured',
        detail:
          'No site-specific adapters are configured beyond the built-in import path.',
      },
    ],
  }
}
