import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { InstanceStatusSummary } from '@/components/settings/instance-status-summary'
import { getInstancePolicySummary } from '@/lib/instance-policy'

describe('InstanceStatusSummary', () => {
  afterEach(cleanup)

  it('renders every service with text status and safe explanatory detail', () => {
    render(
      <InstanceStatusSummary
        summary={getInstancePolicySummary({
          NODE_ENV: 'production',
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
        })}
      />,
    )

    expect(screen.getByText('Email delivery')).toBeInTheDocument()
    expect(screen.getByText('Public catalog')).toBeInTheDocument()
    expect(screen.getByText('Policy required')).toBeInTheDocument()
    expect(
      screen.queryByText(/Secret values are never shown here/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Hosted public imports stay disabled/i),
    ).toBeInTheDocument()
  })
})
