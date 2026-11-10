import { describe, expect, it } from 'vitest'
import { getInstancePolicySummary } from '@/lib/instance-policy'

const baseEnvironment = {
  NODE_ENV: 'production' as const,
  SMTP_ENABLED: false,
  SMTP_HOST: 'localhost',
  SMTP_FROM: 'noreply@example.test',
  POSTHOG_ENABLED: false,
  NEXT_PUBLIC_POSTHOG_KEY: undefined,
  NEXT_PUBLIC_POSTHOG_HOST: undefined,
  RECIPE_IMPORTS_ENABLED: true,
  RECIPE_IMPORT_DISABLED_ADAPTERS: '',
  PUBLIC_CATALOG_POLICIES_PUBLISHED: false,
  PUBLIC_CATALOG_TERMS_URL: undefined,
  PUBLIC_CATALOG_PRIVACY_URL: undefined,
  PUBLIC_CATALOG_REMOVAL_CONTACT: undefined,
  PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL: undefined,
  PUBLIC_CATALOG_DMCA_AGENT_NAME: undefined,
  PUBLIC_CATALOG_DMCA_AGENT_CONTACT: undefined,
  PUBLIC_CATALOG_DMCA_NOTICE_URL: undefined,
  PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL: undefined,
}

describe('instance policy summary', () => {
  it('reports safe defaults without exposing configuration secrets', () => {
    const summary = getInstancePolicySummary(baseEnvironment)

    expect(summary.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'email',
          status: 'disabled',
          statusLabel: 'Disabled',
        }),
        expect.objectContaining({
          id: 'analytics',
          status: 'disabled',
          statusLabel: 'Disabled',
          optionalIntegration: expect.objectContaining({
            licensing: expect.stringContaining('PostHog'),
            cost: expect.stringContaining('paid analytics'),
            dataSharing: expect.stringContaining('No analytics data'),
          }),
        }),
        expect.objectContaining({
          id: 'public-catalog',
          status: 'incomplete',
          statusLabel: 'Policy required',
        }),
      ]),
    )
    expect(JSON.stringify(summary)).not.toContain('POSTHOG')
    expect(JSON.stringify(summary)).not.toContain('noreply@example.test')
  })

  it('shows configured services and only names active importer counts', () => {
    const summary = getInstancePolicySummary({
      ...baseEnvironment,
      SMTP_ENABLED: true,
      POSTHOG_ENABLED: true,
      NEXT_PUBLIC_POSTHOG_KEY: 'secret-key',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://analytics.example.test',
      RECIPE_IMPORT_DISABLED_ADAPTERS: 'generic-html',
    })

    expect(summary.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'email',
          status: 'enabled',
          detail: 'Delivery is enabled through localhost.',
        }),
        expect.objectContaining({
          id: 'analytics',
          status: 'enabled',
          detail: 'Only allowlisted, content-free product events are eligible.',
        }),
        expect.objectContaining({
          id: 'importer',
          status: 'enabled',
          detail: '1 built-in adapter available for reviewable imports.',
          optionalIntegration: expect.objectContaining({
            licensing: expect.stringContaining('source and site terms'),
            cost: expect.stringContaining('No paid recipe API'),
            dataSharing: expect.stringContaining('fetched by this instance'),
          }),
        }),
      ]),
    )
    expect(JSON.stringify(summary)).not.toContain('secret-key')
    expect(JSON.stringify(summary)).not.toContain('analytics.example.test')
  })

  it('shows incomplete status when an opted-in integration is missing fields', () => {
    const summary = getInstancePolicySummary({
      ...baseEnvironment,
      SMTP_ENABLED: true,
      SMTP_HOST: '',
      POSTHOG_ENABLED: true,
    })

    expect(summary.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'email', status: 'incomplete' }),
        expect.objectContaining({ id: 'analytics', status: 'incomplete' }),
      ]),
    )
  })

  it('shows public imports as disabled without hiding unaffected workflows', () => {
    const summary = getInstancePolicySummary({
      ...baseEnvironment,
      RECIPE_IMPORTS_ENABLED: false,
    })

    expect(summary.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'public-catalog',
          status: 'disabled',
          statusLabel: 'Disabled',
          detail: expect.stringContaining('manual recipes'),
        }),
      ]),
    )
  })

  it('marks hosted imports enabled only after every policy is published', () => {
    const summary = getInstancePolicySummary({
      ...baseEnvironment,
      PUBLIC_CATALOG_POLICIES_PUBLISHED: true,
      PUBLIC_CATALOG_TERMS_URL: 'https://platter.example/terms',
      PUBLIC_CATALOG_PRIVACY_URL: 'https://platter.example/privacy',
      PUBLIC_CATALOG_REMOVAL_CONTACT: 'copyright@platter.example',
      PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL:
        'https://platter.example/repeat-infringer',
    })

    expect(summary.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'public-catalog',
          status: 'enabled',
          statusLabel: 'Enabled',
        }),
      ]),
    )
  })

  it('reports optional DMCA settings as incomplete until all public fields exist', () => {
    expect(
      getInstancePolicySummary({
        ...baseEnvironment,
        PUBLIC_CATALOG_DMCA_AGENT_NAME: 'Platter Rights Agent',
      }).services,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dmca',
          status: 'incomplete',
          statusLabel: 'Incomplete',
        }),
      ]),
    )

    expect(
      getInstancePolicySummary({
        ...baseEnvironment,
        PUBLIC_CATALOG_DMCA_AGENT_NAME: 'Platter Rights Agent',
        PUBLIC_CATALOG_DMCA_AGENT_CONTACT: 'rights@example.test',
        PUBLIC_CATALOG_DMCA_NOTICE_URL: 'https://platter.example/dmca/notice',
        PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL:
          'https://platter.example/dmca/counter-notice',
      }).services,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dmca',
          status: 'enabled',
          statusLabel: 'Configured',
        }),
      ]),
    )
  })
})
