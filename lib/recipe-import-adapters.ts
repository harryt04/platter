import type { RecipeImportFetchResult } from '@/lib/recipe-import-fetcher'
import { recipeImportFetchDefaults } from '@/lib/recipe-import-fetcher'
import {
  extractSchemaOrgRecipe,
  type RecipeImportCandidate,
} from '@/lib/recipe-import-schema-org'
import { extractGenericRecipe } from '@/lib/recipe-import-generic'
import type { RecipeImportImporter } from '@/lib/recipe-imports'

export type RecipeImportAdapterContent = Pick<
  RecipeImportFetchResult,
  'finalUrl' | 'contentType' | 'body' | 'byteLength'
>

export type RecipeImportAdapterFailureCode =
  | 'INVALID_CONTENT'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'RECIPE_DATA_NOT_FOUND'
  | 'ADAPTER_DISABLED'
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
  enabled?: boolean
  supports?: (content: RecipeImportAdapterContent) => boolean
  extract: (content: RecipeImportAdapterContent) =>
    | {
        candidate: RecipeImportCandidate
      }
    | {
        failure: RecipeImportAdapterFailure
      }
}

export type RecipeImportAdapterSelectionOptions = {
  /** Site adapters are ordered by specificity and may be disabled by config. */
  supportedAdapters?: readonly RecipeImportAdapter[]
  /** Built-in and site adapters disabled by the operator. */
  disabledAdapterIds?: readonly string[]
}

export function parseDisabledRecipeImportAdapters(value: string | undefined) {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((adapterId) => adapterId.trim())
        .filter(Boolean),
    ),
  ]
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

export const genericHtmlRecipeAdapter: RecipeImportAdapter = {
  adapterId: 'generic-html',
  extract: (content) => ({
    candidate: extractGenericRecipe(content.body, content.finalUrl),
  }),
}

/** Choose structured, site-specific, then conservative generic extraction. */
export function selectRecipeImportAdapter(
  content: RecipeImportAdapterContent,
  options: RecipeImportAdapterSelectionOptions = {},
) {
  const disabledAdapterIds = new Set(options.disabledAdapterIds ?? [])

  if (!disabledAdapterIds.has(schemaOrgRecipeAdapter.adapterId)) {
    const primary = runRecipeImportAdapter(schemaOrgRecipeAdapter, content)
    if (primary.kind !== 'failure') return primary
  }

  for (const adapter of options.supportedAdapters ?? []) {
    if (adapter.enabled === false || disabledAdapterIds.has(adapter.adapterId))
      continue
    try {
      if (adapter.supports && !adapter.supports(content)) continue
    } catch {
      continue
    }
    const result = runRecipeImportAdapter(adapter, content)
    if (result.kind !== 'failure') return result
  }

  if (disabledAdapterIds.has(genericHtmlRecipeAdapter.adapterId)) {
    return {
      kind: 'failure' as const,
      adapterId: genericHtmlRecipeAdapter.adapterId,
      failure: { code: 'ADAPTER_DISABLED' as const },
    }
  }

  return runRecipeImportAdapter(genericHtmlRecipeAdapter, content)
}
