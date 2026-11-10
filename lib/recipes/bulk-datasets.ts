import { z } from 'zod'

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://'),
    'Dataset links must use HTTP or HTTPS.',
  )

const safeTextSchema = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      `${label} cannot contain control characters.`,
    )

/**
 * A bulk dataset may enter the public catalog only with a recorded source,
 * terms, license, and attribution. The rights class is deliberately explicit
 * so noncommercial or unknown data cannot be treated as compatible by
 * omission or by an ambiguous license name.
 */
export const bulkDatasetManifestSchema = z.object({
  datasetId: z
    .string({ error: 'Dataset ID is required.' })
    .trim()
    .min(1, 'Dataset ID is required.')
    .max(100, 'Dataset IDs must be 100 characters or fewer.')
    .regex(
      /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
      'Dataset IDs must use lowercase letters, numbers, hyphens, or underscores.',
    ),
  datasetName: safeTextSchema('Dataset name', 200),
  sourceUrl: httpUrlSchema,
  termsUrl: httpUrlSchema,
  licenseName: safeTextSchema('License name', 200),
  licenseUrl: httpUrlSchema,
  attribution: safeTextSchema('Attribution', 2_000),
  rightsClass: z.enum([
    'commercial-compatible',
    'noncommercial-only',
    'unknown',
  ]),
  termsAcceptedAt: z.string().datetime({ offset: true }),
})

export type BulkDatasetManifest = z.infer<typeof bulkDatasetManifestSchema>

export type BulkDatasetPolicyIssue = {
  path: string
  message: string
}

export class BulkDatasetPolicyError extends Error {
  readonly code = 'BULK_DATASET_POLICY_REJECTED'
  readonly issues: BulkDatasetPolicyIssue[]

  constructor(issues: BulkDatasetPolicyIssue[]) {
    super('Bulk dataset cannot be added to the public catalog.')
    this.name = 'BulkDatasetPolicyError'
    this.issues = issues
  }
}

/**
 * Validate and authorize a manifest at the bulk-ingestion boundary. Keeping
 * this check separate from parsing lets future loaders reuse the same
 * fail-closed policy without making parser output imply content rights.
 */
export function assertBulkDatasetCompatible(
  input: unknown,
): BulkDatasetManifest {
  const parsed = bulkDatasetManifestSchema.safeParse(input)
  if (!parsed.success) {
    throw new BulkDatasetPolicyError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'manifest',
        message: issue.message,
      })),
    )
  }

  if (parsed.data.rightsClass !== 'commercial-compatible') {
    throw new BulkDatasetPolicyError([
      {
        path: 'rightsClass',
        message:
          'Only datasets with explicitly recorded commercial-compatible terms may enter the public catalog.',
      },
    ])
  }

  return parsed.data
}
