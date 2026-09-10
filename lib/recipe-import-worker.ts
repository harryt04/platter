import { createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { isoDateTime } from '@/lib/contracts/ids'
import { serverEnv } from '@/lib/env/server'
import { validateJobPayload } from '@/lib/jobs/registry'
import {
  parseDisabledRecipeImportAdapters,
  selectRecipeImportAdapter,
} from '@/lib/recipe-import-adapters'
import {
  fetchRecipeSource,
  isRecipeImportFetchError,
  type RecipeImportFetchResult,
} from '@/lib/recipe-import-fetcher'
import { extractCanonicalUrl } from '@/lib/recipe-import-schema-org'
import type { RecipeImportDocument } from '@/lib/recipe-imports'

export const recipeImportRetryPolicy = {
  maxAttempts: 4,
  maxRetries: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
} as const

type RecipeImportJob = {
  attrs: { data?: unknown }
}

export type RecipeImportFetcher = (
  sourceUrl: string,
) => Promise<RecipeImportFetchResult>

const retryableFetchErrorCodes = new Set([
  'DNS_LOOKUP_FAILED',
  'TIMEOUT',
  'UPSTREAM_FAILURE',
])

function isRetryableFetchFailure(code: string) {
  return retryableFetchErrorCodes.has(code)
}

export function createRecipeImportJobHandler(
  db: Db,
  fetcher: RecipeImportFetcher = fetchRecipeSource,
) {
  return async (job: RecipeImportJob) => {
    const payload = validateJobPayload('recipe-import', job.attrs.data)
    const collection = db.collection<RecipeImportDocument>('recipe_imports')
    const document = await collection.findOneAndUpdate(
      {
        _id: payload.importId,
        userId: payload.userId,
        idempotencyKey: payload.idempotencyKey,
        status: { $in: ['queued', 'retrying'] },
        ...(payload.jobGeneration
          ? { jobGeneration: payload.jobGeneration }
          : {}),
      },
      {
        $set: { status: 'processing', updatedAt: isoDateTime(new Date()) },
        $inc: { attemptCount: 1 },
      },
      { returnDocument: 'after' },
    )
    if (!document) {
      throw new Error('Recipe import record is no longer queued.')
    }

    const processingFilter = {
      _id: payload.importId,
      userId: payload.userId,
      status: 'processing' as const,
      ...(payload.jobGeneration
        ? { jobGeneration: payload.jobGeneration }
        : {}),
    }

    try {
      const fetched = await fetcher(document.sourceUrl)
      const adapted = selectRecipeImportAdapter(fetched, {
        disabledAdapterIds: parseDisabledRecipeImportAdapters(
          serverEnv().RECIPE_IMPORT_DISABLED_ADAPTERS,
        ),
      })
      if (adapted.kind === 'failure') {
        await collection.updateOne(processingFilter, {
          $set: {
            status: 'failed',
            failureCode: adapted.failure.code,
            updatedAt: isoDateTime(new Date()),
          },
        })
        return
      }
      const preview = adapted.candidate
      const acquiredAt = isoDateTime(new Date())
      const canonicalUrl =
        extractCanonicalUrl(fetched.body, fetched.finalUrl) ?? fetched.finalUrl
      const sourceDomain = new URL(canonicalUrl).hostname.replace(/^www\./i, '')
      const contentFingerprint = `sha256:${createHash('sha256')
        .update(fetched.body, 'utf8')
        .digest('hex')}`
      await collection.updateOne(processingFilter, {
        $set: {
          status: 'preview-ready',
          preview,
          canonicalUrl,
          sourceDomain,
          ...(preview.title ? { sourceTitle: preview.title } : {}),
          ...(preview.sourceAuthor
            ? { sourceAuthor: preview.sourceAuthor }
            : {}),
          importer: adapted.adapterId,
          acquiredAt,
          acquisitionMethod: 'server-fetch',
          contentFingerprint,
          rightsStatus: 'unknown',
          updatedAt: isoDateTime(new Date()),
        },
        $unset: { failureCode: '' },
      })
    } catch (error) {
      const failureCode = isRecipeImportFetchError(error)
        ? error.code
        : 'UPSTREAM_FAILURE'
      const shouldRetry =
        isRetryableFetchFailure(failureCode) &&
        document.attemptCount < recipeImportRetryPolicy.maxAttempts

      if (shouldRetry) {
        await collection.updateOne(
          {
            _id: payload.importId,
            userId: payload.userId,
            status: 'processing',
          },
          {
            $set: {
              status: 'retrying',
              updatedAt: isoDateTime(new Date()),
            },
            $unset: { failureCode: '' },
          },
        )
        throw isRecipeImportFetchError(error)
          ? error
          : new Error('Recipe source request failed.')
      }

      await collection.updateOne(processingFilter, {
        $set: {
          status: 'failed',
          failureCode,
          updatedAt: isoDateTime(new Date()),
        },
      })
      return
    }
  }
}
