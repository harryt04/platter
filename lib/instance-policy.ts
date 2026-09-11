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

type PublicCatalogPolicyEnvironment = Pick<
  ServerEnv,
  | 'NODE_ENV'
  | 'PUBLIC_CATALOG_POLICIES_PUBLISHED'
  | 'PUBLIC_CATALOG_TERMS_URL'
  | 'PUBLIC_CATALOG_PRIVACY_URL'
  | 'PUBLIC_CATALOG_REMOVAL_CONTACT'
  | 'PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL'
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
