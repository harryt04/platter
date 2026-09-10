import type { Db } from 'mongodb'
import { isoDateTime } from '@/lib/contracts/ids'
import { validateJobPayload } from '@/lib/jobs/registry'
import {
  fetchRecipeSource,
  isRecipeImportFetchError,
  type RecipeImportFetchResult,
} from '@/lib/recipe-import-fetcher'
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

    try {
      // The next importer stage will normalize this bounded body. Until then,
      // never persist or publish fetched source content as an approved recipe.
      await fetcher(document.sourceUrl)
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

      await collection.updateOne(
        { _id: payload.importId, userId: payload.userId, status: 'processing' },
        {
          $set: {
            status: 'failed',
            failureCode,
            updatedAt: isoDateTime(new Date()),
          },
        },
      )
      return
    }
  }
}
