import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RunHistoryPage from '@/app/(app)/lists/[listId]/history/[runId]/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  findListForMember: vi.fn(),
  getConnectedDatabase: vi.fn(),
  recipeVersions: {},
  findShoppingRunHistory: vi.fn(),
  resolvePinnedRecipeVersions: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({
  requireSession: mocks.requireSession,
}))
vi.mock('@/lib/lists', () => ({
  findListForMember: mocks.findListForMember,
}))
vi.mock('@/lib/db/mongo-client', () => ({
  getConnectedDatabase: mocks.getConnectedDatabase,
}))
vi.mock('@/lib/shopping-run-history', () => ({
  findShoppingRunHistory: mocks.findShoppingRunHistory,
  formatShoppingRunHistoryDate: () => 'Sep 10, 2026',
}))
vi.mock('@/lib/recipes/versions', () => ({
  resolvePinnedRecipeVersions: mocks.resolvePinnedRecipeVersions,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireSession.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.findListForMember.mockResolvedValue({
    _id: 'list-1',
    name: 'Family',
  })
  mocks.getConnectedDatabase.mockResolvedValue({
    collection: vi.fn(() => mocks.recipeVersions),
  })
  mocks.findShoppingRunHistory.mockResolvedValue({
    _id: 'history-1',
    listId: 'list-1',
    completedAt: '2026-09-10T18:00:00.000Z',
    localDate: '2026-09-10',
    completedByUserId: 'member-2',
    recipeSelections: [
      {
        _id: 'selection-1',
        recipeId: 'recipe-1',
        versionId: 'version-3',
        versionNumber: 3,
        desiredPeople: 6,
      },
    ],
  })
  mocks.resolvePinnedRecipeVersions.mockResolvedValue([
    {
      reference: {
        _id: 'selection-1',
        recipeId: 'recipe-1',
        versionId: 'version-3',
        versionNumber: 3,
        desiredPeople: 6,
      },
      version: { title: 'Citrus tacos' },
    },
  ])
})

describe('completed shopping run history detail', () => {
  it('shows the retained completion facts without rendering a final checklist', async () => {
    render(
      await RunHistoryPage({
        params: Promise.resolve({ listId: 'list-1', runId: 'history-1' }),
      }),
    )

    expect(screen.getByText('Sep 10, 2026')).toBeInTheDocument()
    expect(screen.getByText('Completed by member-2')).toBeInTheDocument()
    expect(
      screen.getByText(
        'These are the recipes this list shopped for. This history does not show the final checklist or claim that the recipes were cooked or that every item was purchased.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Recipes shopped for' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Citrus tacos')).toBeInTheDocument()
    expect(screen.getByText('Version 3 · 6 people')).toBeInTheDocument()
    expect(screen.queryByText('Purchased')).toBeNull()
    expect(screen.queryByText('Already have')).toBeNull()
    expect(mocks.findShoppingRunHistory).toHaveBeenCalledWith(
      expect.objectContaining({ collection: expect.any(Function) }),
      'list-1',
      'history-1',
    )
    expect(mocks.resolvePinnedRecipeVersions).toHaveBeenCalledWith(
      mocks.recipeVersions,
      [expect.objectContaining({ versionId: 'version-3' })],
    )
  })
})
