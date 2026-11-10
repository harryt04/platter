import { describe, expect, it, vi } from 'vitest'
import {
  findActivePublicContentSuppressionForImport,
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

  it('matches a content fingerprint and normalizes it case-insensitively', () => {
    const target = normalizePublicContentSuppressionTarget(
      'fingerprint',
      `SHA256:${'A'.repeat(64)}`,
    )

    expect(target).toBe(`sha256:${'a'.repeat(64)}`)
    expect(
      publicContentSuppressionRecipeFilter({
        targetType: 'fingerprint',
        target,
      }),
    ).toEqual({ 'importProvenance.contentFingerprint': target })
  })

  it('builds one lookup for recipe, source, fingerprint, and domain suppression', async () => {
    const findOne = vi.fn().mockResolvedValue({ _id: 'suppression-1' })
    const db = {
      collection: vi.fn().mockReturnValue({ findOne }),
    }

    await findActivePublicContentSuppressionForImport(db as never, {
      recipeId: 'recipe-1',
      submittedUrl: 'https://www.example.com/recipe#step-1',
      canonicalUrl: 'https://example.com/recipe',
      sourceDomain: 'WWW.Example.COM',
      contentFingerprint: `SHA256:${'A'.repeat(64)}`,
    })

    expect(findOne).toHaveBeenCalledWith(
      {
        status: 'active',
        $or: [
          { targetType: 'recipe', target: 'recipe-1' },
          {
            targetType: 'source-url',
            target: 'https://www.example.com/recipe',
          },
          { targetType: 'source-url', target: 'https://example.com/recipe' },
          { targetType: 'fingerprint', target: `sha256:${'a'.repeat(64)}` },
          { targetType: 'domain', target: 'example.com' },
        ],
      },
      undefined,
    )
  })
})
