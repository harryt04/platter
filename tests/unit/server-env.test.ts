import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseServerEnvironment,
  resetServerEnvForTests,
} from '@/lib/env/server'

describe('server environment validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    resetServerEnvForTests()
  })

  it('keeps optional integrations disabled by default', () => {
    const environment = parseServerEnvironment({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017',
      MONGODB_DATABASE: 'platter_test',
      SMTP_ENABLED: '',
      SMTP_SECURE: '',
      POSTHOG_ENABLED: '',
      RECIPE_IMPORTS_ENABLED: '',
      PUBLIC_CATALOG_POLICIES_PUBLISHED: '',
    })

    expect(environment.SMTP_ENABLED).toBe(false)
    expect(environment.SMTP_SECURE).toBe(false)
    expect(environment.POSTHOG_ENABLED).toBe(false)
    expect(environment.RECIPE_IMPORTS_ENABLED).toBe(true)
    expect(environment.PUBLIC_CATALOG_POLICIES_PUBLISHED).toBe(false)
  })

  it('accepts explicit boolean strings without coercing arbitrary values', () => {
    const environment = parseServerEnvironment({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017',
      MONGODB_DATABASE: 'platter_test',
      SMTP_ENABLED: 'true',
      SMTP_SECURE: 'false',
      POSTHOG_ENABLED: 'true',
      RECIPE_IMPORTS_ENABLED: 'false',
      PUBLIC_CATALOG_POLICIES_PUBLISHED: 'true',
    })

    expect(environment.SMTP_ENABLED).toBe(true)
    expect(environment.SMTP_SECURE).toBe(false)
    expect(environment.POSTHOG_ENABLED).toBe(true)
    expect(environment.RECIPE_IMPORTS_ENABLED).toBe(false)
    expect(environment.PUBLIC_CATALOG_POLICIES_PUBLISHED).toBe(true)
  })

  it('rejects invalid boolean configuration instead of treating it as true', () => {
    expect(() =>
      parseServerEnvironment({
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DATABASE: 'platter_test',
        RECIPE_IMPORTS_ENABLED: 'enabled',
      }),
    ).toThrow(/Invalid server environment/)
  })
})
