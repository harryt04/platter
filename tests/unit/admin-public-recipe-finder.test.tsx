import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PublicRecipeFinder } from '@/components/admin/public-recipe-finder'
import { isoDateTime } from '@/lib/contracts/ids'
import type { AdminPublicRecipeSummary } from '@/lib/admin-public-recipes'

const recipe: AdminPublicRecipeSummary = {
  id: 'recipe-1',
  title: 'Synthetic soup',
  status: 'usable',
  visibility: 'public',
  origin: 'imported',
  importReviewStatus: 'approved',
  sourceName: 'Synthetic kitchen',
  sourceUrl: 'https://example.com/soup',
  sourceAuthor: 'A. Cook',
  sourceDomain: 'example.com',
  importer: 'schema-org-json-ld',
  contentFingerprint: 'sha256:abc',
  rightsStatus: 'unknown',
  updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
}

describe('PublicRecipeFinder', () => {
  afterEach(() => cleanup())

  it('exposes supported search fields and public provenance metadata', () => {
    render(
      <PublicRecipeFinder
        field="fingerprint"
        initialRecipes={[recipe]}
        query="sha256:abc"
      />,
    )

    expect(screen.getByLabelText('Search by')).toHaveValue('fingerprint')
    expect(screen.getByLabelText('Search value')).toHaveValue('sha256:abc')
    expect(screen.getByText('Synthetic soup')).toBeInTheDocument()
    expect(
      screen.getByText('schema-org-json-ld · approved'),
    ).toBeInTheDocument()
    expect(screen.getByText('sha256:abc')).toBeInTheDocument()
    expect(screen.getByText('Rights: unknown')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'https://example.com/soup' }),
    ).toHaveAttribute('target', '_blank')
  })

  it('names an empty search outcome and clear action', () => {
    render(
      <PublicRecipeFinder
        field="domain"
        initialRecipes={[]}
        query="missing.example"
      />,
    )

    expect(
      screen.getByText('No public content matched “missing.example”.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clear' })).toHaveAttribute(
      'href',
      '/admin/public-recipes',
    )
  })
})
