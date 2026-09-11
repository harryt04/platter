import { describe, expect, it } from 'vitest'
import {
  normalizePublicContentSuppressionTarget,
  publicContentSuppressionRecipeFilter,
} from '@/lib/public-content-suppressions'

describe('public content suppression recipe filters', () => {
  it('matches an individual recipe identity', () => {
    expect(
      publicContentSuppressionRecipeFilter({
        targetType: 'recipe',
        target: 'recipe-1',
      }),
    ).toEqual({ _id: 'recipe-1' })
  })

  it('matches a normalized source URL across recipe provenance fields', () => {
    const target = normalizePublicContentSuppressionTarget(
      'source-url',
      'https://Example.com/soup#ingredients',
    )

    expect(
      publicContentSuppressionRecipeFilter({
        targetType: 'source-url',
        target,
      }),
    ).toEqual({
      $or: [
        { sourceUrl: { $regex: '^https://example\\.com/soup(?:#.*)?$' } },
        {
          'importProvenance.submittedUrl': {
            $regex: '^https://example\\.com/soup(?:#.*)?$',
          },
        },
        {
          'importProvenance.canonicalUrl': {
            $regex: '^https://example\\.com/soup(?:#.*)?$',
          },
        },
      ],
    })
  })

  it('matches a domain in normalized provenance and URL fields', () => {
    expect(
      publicContentSuppressionRecipeFilter({
        targetType: 'domain',
        target: 'example.com',
      }),
    ).toEqual({
      $or: [
        { 'importProvenance.sourceDomain': 'example.com' },
        {
          sourceUrl: {
            $regex: '^https?://(?:www\\.)?example\\.com(?::\\d+)?(?:/|$)',
            $options: 'i',
          },
        },
        {
          'importProvenance.submittedUrl': {
            $regex: '^https?://(?:www\\.)?example\\.com(?::\\d+)?(?:/|$)',
            $options: 'i',
          },
        },
        {
          'importProvenance.canonicalUrl': {
            $regex: '^https?://(?:www\\.)?example\\.com(?::\\d+)?(?:/|$)',
            $options: 'i',
          },
        },
      ],
    })
  })
})
