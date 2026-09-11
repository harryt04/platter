import { serverEnv, type ServerEnv } from '@/lib/env/server'
import { parseDisabledRecipeImportAdapters } from '@/lib/recipe-import-adapters'

export type InstanceServiceStatus = 'enabled' | 'disabled' | 'incomplete'

export type InstanceServiceSummary = {
  id:
    | 'email'
    | 'analytics'
    | 'public-catalog'
    | 'importer'
    | 'moderation'
    | 'source-adapters'
  label: string
  status: InstanceServiceStatus
  statusLabel: string
  detail: string
}

export type InstancePolicySummary = {
  services: InstanceServiceSummary[]
}

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
>

const builtInImporterIds = ['schema-org-json-ld', 'generic-html'] as const

function configuredEmailStatus(env: InstancePolicyEnvironment) {
  if (!env.SMTP_ENABLED) {
    return {
      status: 'disabled' as const,
      statusLabel: 'Disabled',
      detail: 'Invitation and password-reset email delivery is turned off.',
    }
  }

  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    return {
      status: 'incomplete' as const,
      statusLabel: 'Incomplete',
      detail: 'SMTP is enabled but its host or sender address is missing.',
    }
  }

  return {
    status: 'enabled' as const,
    statusLabel: 'Enabled',
    detail: `Delivery is enabled through ${env.SMTP_HOST}.`,
  }
}

function configuredAnalyticsStatus(env: InstancePolicyEnvironment) {
  if (!env.POSTHOG_ENABLED) {
    return {
      status: 'disabled' as const,
      statusLabel: 'Disabled',
      detail: 'Analytics remains a typed no-op until an operator opts in.',
    }
  }

  if (!env.NEXT_PUBLIC_POSTHOG_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST) {
    return {
      status: 'incomplete' as const,
      statusLabel: 'Incomplete',
      detail: 'Analytics is opted in but its provider key or host is missing.',
    }
  }

  return {
    status: 'enabled' as const,
    statusLabel: 'Enabled',
    detail: 'Only allowlisted, content-free product events are eligible.',
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
        status: environment.RECIPE_IMPORTS_ENABLED ? 'incomplete' : 'disabled',
        statusLabel: environment.RECIPE_IMPORTS_ENABLED
          ? 'Policy required'
          : 'Disabled',
        detail: environment.RECIPE_IMPORTS_ENABLED
          ? 'Hosted public imports are not ready to be enabled until terms, privacy, removal contact, and repeat-infringer handling are published.'
          : 'New public URL imports are disabled; manual recipes, existing saved recipes, and shopping remain available.',
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
