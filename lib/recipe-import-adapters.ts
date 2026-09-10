import type { RecipeImportFetchResult } from '@/lib/recipe-import-fetcher'
import { recipeImportFetchDefaults } from '@/lib/recipe-import-fetcher'
import {
  extractSchemaOrgRecipe,
  type RecipeImportCandidate,
} from '@/lib/recipe-import-schema-org'
import type { RecipeImportImporter } from '@/lib/recipe-imports'

export type RecipeImportAdapterContent = Pick<
  RecipeImportFetchResult,
  'finalUrl' | 'contentType' | 'body' | 'byteLength'
>

export type RecipeImportAdapterFailureCode =
  | 'INVALID_CONTENT'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'RECIPE_DATA_NOT_FOUND'
  | 'ADAPTER_FAILED'

export type RecipeImportAdapterFailure = {
  code: RecipeImportAdapterFailureCode
}

export type RecipeImportAdapterResult =
  | {
      kind: 'candidate'
      adapterId: RecipeImportImporter
      candidate: RecipeImportCandidate
    }
  | {
      kind: 'partial'
      adapterId: RecipeImportImporter
      candidate: RecipeImportCandidate
      warnings: string[]
    }
  | {
      kind: 'failure'
      adapterId: RecipeImportImporter
      failure: RecipeImportAdapterFailure
    }

export type RecipeImportAdapter = {
  adapterId: RecipeImportImporter
  extract: (content: RecipeImportAdapterContent) =>
    | {
        candidate: RecipeImportCandidate
      }
    | {
        failure: RecipeImportAdapterFailure
      }
}

function invalidContent(content: RecipeImportAdapterContent) {
  return (
    !Number.isInteger(content.byteLength) ||
    content.byteLength < 0 ||
    content.byteLength > recipeImportFetchDefaults.maxResponseBytes ||
    Buffer.byteLength(content.body, 'utf8') >
      recipeImportFetchDefaults.maxResponseBytes
  )
}

export function runRecipeImportAdapter(
  adapter: RecipeImportAdapter,
  content: RecipeImportAdapterContent,
): RecipeImportAdapterResult {
  if (invalidContent(content)) {
    return {
      kind: 'failure',
      adapterId: adapter.adapterId,
      failure: { code: 'INVALID_CONTENT' },
    }
  }
  if (
    content.contentType !== 'text/html' &&
    content.contentType !== 'application/xhtml+xml'
  ) {
    return {
      kind: 'failure',
      adapterId: adapter.adapterId,
      failure: { code: 'UNSUPPORTED_CONTENT_TYPE' },
    }
  }

  try {
    const result = adapter.extract(content)
    if ('failure' in result) {
      return {
        kind: 'failure',
        adapterId: adapter.adapterId,
        failure: result.failure,
      }
    }
    if (result.candidate.warnings.length > 0) {
      return {
        kind: 'partial',
        adapterId: adapter.adapterId,
        candidate: result.candidate,
        warnings: result.candidate.warnings,
      }
    }
    return {
      kind: 'candidate',
      adapterId: adapter.adapterId,
      candidate: result.candidate,
    }
  } catch {
    return {
      kind: 'failure',
      adapterId: adapter.adapterId,
      failure: { code: 'ADAPTER_FAILED' },
    }
  }
}

/** The first replaceable adapter. Site-specific and generic adapters can be added behind this contract. */
export const schemaOrgRecipeAdapter: RecipeImportAdapter = {
  adapterId: 'schema-org-json-ld',
  extract: (content) => {
    const candidate = extractSchemaOrgRecipe(content.body, content.finalUrl)
    return candidate
      ? { candidate }
      : { failure: { code: 'RECIPE_DATA_NOT_FOUND' } }
  },
}
