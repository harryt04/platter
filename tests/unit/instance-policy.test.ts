import { describe, expect, it } from 'vitest'
import { getInstancePolicySummary } from '@/lib/instance-policy'

const baseEnvironment = {
  SMTP_ENABLED: false,
  SMTP_HOST: 'localhost',
  SMTP_FROM: 'noreply@example.test',
  POSTHOG_ENABLED: false,
  NEXT_PUBLIC_POSTHOG_KEY: undefined,
  NEXT_PUBLIC_POSTHOG_HOST: undefined,
  RECIPE_IMPORTS_ENABLED: true,
  RECIPE_IMPORT_DISABLED_ADAPTERS: '',
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
})
