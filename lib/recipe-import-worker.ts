import type { Db } from 'mongodb'
import { isoDateTime } from '@/lib/contracts/ids'
import { validateJobPayload } from '@/lib/jobs/registry'
import {
  fetchRecipeSource,
  isRecipeImportFetchError,
  type RecipeImportFetchResult,
} from '@/lib/recipe-import-fetcher'
import type { RecipeImportDocument } from '@/lib/recipe-imports'

type RecipeImportJob = {
  attrs: { data?: unknown }
}

export type RecipeImportFetcher = (
  sourceUrl: string,
) => Promise<RecipeImportFetchResult>

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
