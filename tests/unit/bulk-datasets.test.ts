import { describe, expect, it } from 'vitest'
import {
  assertBulkDatasetCompatible,
  bulkDatasetManifestSchema,
  BulkDatasetPolicyError,
} from '@/lib/recipes/bulk-datasets'

const compatibleManifest = {
  datasetId: 'synthetic-recipes-v1',
  datasetName: 'Synthetic recipes for Platter tests',
  sourceUrl: 'https://datasets.example.test/synthetic-recipes-v1',
  termsUrl: 'https://datasets.example.test/synthetic-recipes-v1/terms',
  licenseName: 'Creative Commons Attribution 4.0 International',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Platter project, synthetic fixture dataset, 2026.',
  rightsClass: 'commercial-compatible' as const,
  termsAcceptedAt: '2026-09-10T12:00:00.000Z',
}

describe('bulk dataset policy', () => {
  it('accepts a complete manifest with explicitly compatible terms', () => {
    expect(assertBulkDatasetCompatible(compatibleManifest)).toEqual(
      compatibleManifest,
    )
  })

  it.each(['noncommercial-only', 'unknown'] as const)(
    'rejects %s rights before catalog publication',
    (rightsClass) => {
      expect(() =>
        assertBulkDatasetCompatible({ ...compatibleManifest, rightsClass }),
      ).toThrow(BulkDatasetPolicyError)

      try {
        assertBulkDatasetCompatible({ ...compatibleManifest, rightsClass })
      } catch (error) {
        expect(error).toMatchObject({
          code: 'BULK_DATASET_POLICY_REJECTED',
          issues: [
            {
              path: 'rightsClass',
              message: expect.stringContaining('commercial-compatible'),
            },
          ],
        })
      }
    },
  )

  it('requires recorded terms, license, attribution, and safe web links', () => {
    const missingRequiredMetadata = { ...compatibleManifest }
    delete (missingRequiredMetadata as Partial<typeof compatibleManifest>)
      .termsUrl
    delete (missingRequiredMetadata as Partial<typeof compatibleManifest>)
      .attribution

    expect(
      bulkDatasetManifestSchema.safeParse(missingRequiredMetadata).success,
    ).toBe(false)
    expect(() =>
      assertBulkDatasetCompatible({
        ...compatibleManifest,
        sourceUrl: 'file:///tmp/recipes.json',
      }),
    ).toThrow(BulkDatasetPolicyError)
  })

  it('rejects ambiguous or malformed manifests before a loader can use them', () => {
    expect(() =>
      assertBulkDatasetCompatible({
        ...compatibleManifest,
        licenseName: '  ',
        termsAcceptedAt: 'not-a-date',
      }),
    ).toThrow(BulkDatasetPolicyError)
  })
})
