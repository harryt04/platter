import { describe, expect, it, vi } from 'vitest'
import {
  genericHtmlRecipeAdapter,
  parseDisabledRecipeImportAdapters,
  runRecipeImportAdapter,
  selectRecipeImportAdapter,
  schemaOrgRecipeAdapter,
} from '@/lib/recipe-import-adapters'

const content = {
  finalUrl: 'https://example.com/recipes/soup',
  contentType: 'text/html',
  body: `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Recipe',
    name: 'Safe soup',
    recipeYield: '4',
    recipeIngredient: ['1 cup carrots'],
    recipeInstructions: ['Simmer.'],
  })}</script>`,
  byteLength: 250,
}

describe('recipe import adapter contract', () => {
  it('parses a comma-separated operator disable list', () => {
    expect([
      ...parseDisabledRecipeImportAdapters(
        ' schema-org-json-ld, generic-html ',
      ),
    ]).toEqual(['schema-org-json-ld', 'generic-html'])
  })

  it('returns a normalized candidate from bounded fetched content', () => {
    expect(runRecipeImportAdapter(schemaOrgRecipeAdapter, content)).toEqual({
      kind: 'candidate',
      adapterId: 'schema-org-json-ld',
      candidate: expect.objectContaining({
        title: 'Safe soup',
        typicalPeopleFed: 4,
        sourceUrl: content.finalUrl,
      }),
    })
  })

  it('returns a partial candidate and preserves extraction warnings', () => {
    const result = runRecipeImportAdapter(schemaOrgRecipeAdapter, {
      ...content,
      body: `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Partial soup',
        recipeIngredient: ['salt to taste'],
      })}</script>`,
    })

    expect(result).toMatchObject({
      kind: 'partial',
      adapterId: 'schema-org-json-ld',
      candidate: { title: 'Partial soup' },
      warnings: [
        'The source did not provide a single whole-number yield.',
        'The source did not provide structured instructions.',
      ],
    })
  })

  it('returns a typed failure when no adapter candidate is available', () => {
    expect(
      runRecipeImportAdapter(schemaOrgRecipeAdapter, {
        ...content,
        body: '<html><title>Not a recipe</title></html>',
      }),
    ).toEqual({
      kind: 'failure',
      adapterId: 'schema-org-json-ld',
      failure: { code: 'RECIPE_DATA_NOT_FOUND' },
    })
  })

  it('rejects content that violates the fetch boundary before extraction', () => {
    const extract = vi.fn().mockReturnValue({
      candidate: { warnings: [] },
    })
    const adapter = { ...schemaOrgRecipeAdapter, extract }

    expect(
      runRecipeImportAdapter(adapter, {
        ...content,
        byteLength: 2 * 1024 * 1024 + 1,
      }),
    ).toEqual({
      kind: 'failure',
      adapterId: 'schema-org-json-ld',
      failure: { code: 'INVALID_CONTENT' },
    })
    expect(extract).not.toHaveBeenCalled()
  })

  it('turns adapter exceptions into a typed isolated failure', () => {
    const adapter = {
      ...schemaOrgRecipeAdapter,
      extract: () => {
        throw new Error('parser bug')
      },
    }

    expect(runRecipeImportAdapter(adapter, content)).toEqual({
      kind: 'failure',
      adapterId: 'schema-org-json-ld',
      failure: { code: 'ADAPTER_FAILED' },
    })
  })

  it('tries enabled site adapters before conservative generic extraction', () => {
    const siteAdapter = {
      adapterId: 'generic-html' as const,
      supports: () => true,
      extract: vi.fn().mockReturnValue({
        candidate: {
          title: 'Site recipe',
          ingredients: [],
          instructions: [],
          sourceUrl: content.finalUrl,
          warnings: [],
        },
      }),
    }

    expect(
      selectRecipeImportAdapter(
        { ...content, body: '<h1>Recipe</h1>' },
        { supportedAdapters: [siteAdapter] },
      ),
    ).toMatchObject({ kind: 'candidate', adapterId: 'generic-html' })
    expect(siteAdapter.extract).toHaveBeenCalledOnce()
  })

  it('falls through to generic extraction when an enabled site adapter fails', () => {
    const siteAdapter = {
      adapterId: 'generic-html' as const,
      supports: () => true,
      extract: vi.fn().mockReturnValue({
        failure: { code: 'ADAPTER_FAILED' as const },
      }),
    }

    const result = selectRecipeImportAdapter(
      {
        ...content,
        body: '<h1>Fallback soup</h1><span itemprop="recipeIngredient">1 cup carrots</span>',
      },
      { supportedAdapters: [siteAdapter] },
    )

    expect(result).toMatchObject({
      kind: 'partial',
      adapterId: 'generic-html',
      candidate: { title: 'Fallback soup' },
    })
    expect(siteAdapter.extract).toHaveBeenCalledOnce()
  })

  it('skips disabled site adapters and uses generic HTML facts', () => {
    const disabledAdapter = {
      adapterId: 'generic-html' as const,
      enabled: false,
      extract: vi.fn(),
    }
    const result = selectRecipeImportAdapter(
      {
        ...content,
        body: '<h1>Fallback soup</h1><span itemprop="recipeIngredient">1 cup carrots</span>',
      },
      { supportedAdapters: [disabledAdapter] },
    )

    expect(result).toMatchObject({
      kind: 'partial',
      adapterId: 'generic-html',
      candidate: {
        title: 'Fallback soup',
        ingredients: [expect.objectContaining({ ingredientName: 'carrots' })],
      },
    })
    expect(disabledAdapter.extract).not.toHaveBeenCalled()
    expect(genericHtmlRecipeAdapter.adapterId).toBe('generic-html')
  })

  it('skips disabled built-ins and reports an isolated failure when none remain', () => {
    const result = selectRecipeImportAdapter(content, {
      disabledAdapterIds: ['schema-org-json-ld', 'generic-html'],
    })

    expect(result).toEqual({
      kind: 'failure',
      adapterId: 'generic-html',
      failure: { code: 'ADAPTER_DISABLED' },
    })
  })
})
