import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyRecipesPage from '@/app/(app)/my-recipes/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
  searchRecipeLibrary: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({
  requireSession: mocks.requireSession,
}))
vi.mock('@/lib/db/mongo-client', () => ({
  getConnectedDatabase: mocks.getConnectedDatabase,
}))
vi.mock('@/lib/recipes/library', () => ({
  decodeRecipeLibraryCursor: vi.fn(() => null),
  searchRecipeLibrary: mocks.searchRecipeLibrary,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireSession.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.getConnectedDatabase.mockResolvedValue({})
  mocks.searchRecipeLibrary.mockResolvedValue({
    entries: [
      {
        recipe: {
          id: 'imported-1',
          title: 'Imported soup',
          origin: 'imported',
          status: 'usable',
          visibility: 'public',
          importProvenance: {
            canonicalUrl: 'https://example.com/recipes/soup',
            submittedUrl: 'https://example.com/recipes/soup?from=import',
            sourceDomain: 'example.com',
            sourceAuthor: 'Alex Rivera',
          },
        },
        access: 'owned',
        sharedListNames: [],
      },
    ],
  })
})

describe('my recipes page', () => {
  it('identifies a saved import in the recipe library', async () => {
    render(await MyRecipesPage({}))

    expect(screen.getByText('Imported recipe')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Imported soup' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit draft' })).toHaveAttribute(
      'href',
      '/recipes/imported-1/edit',
    )
    expect(screen.getByRole('link', { name: 'example.com' })).toHaveAttribute(
      'href',
      'https://example.com/recipes/soup',
    )
    expect(screen.getByText('By Alex Rivera')).toBeInTheDocument()
  })
})
