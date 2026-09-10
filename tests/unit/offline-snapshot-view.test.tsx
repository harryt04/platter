import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineSnapshotView } from '@/components/states/offline-snapshot-view'

const mocks = vi.hoisted(() => ({
  getOfflineSnapshots: vi.fn(),
  getOfflineShellSnapshot: vi.fn(),
  getRememberedOfflineUser: vi.fn(),
}))
vi.mock('@/lib/offline/database', () => ({
  getOfflineSnapshots: mocks.getOfflineSnapshots,
  getOfflineShellSnapshot: mocks.getOfflineShellSnapshot,
  getRememberedOfflineUser: mocks.getRememberedOfflineUser,
}))

describe('OfflineSnapshotView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRememberedOfflineUser.mockReturnValue('user-1')
    mocks.getOfflineShellSnapshot.mockResolvedValue({
      userId: 'user-1',
      payload: {
        kind: 'shell',
        lists: [{ id: 'list-1', name: 'Family', status: 'active' }],
      },
      updatedAt: '2026-09-10T12:00:00.000Z',
    })
    mocks.getOfflineSnapshots.mockResolvedValue([
      {
        listId: 'list-1',
        runId: 'run-1',
        revision: 4,
        userId: 'user-1',
        updatedAt: '2026-09-10T12:00:00.000Z',
        payload: {
          kind: 'run',
          listId: 'list-1',
          listName: 'Family',
          listStatus: 'active',
          runId: 'run-1',
          revision: 4,
          groceryItemCount: 3,
          recipeSelections: [
            { id: 'selection-1', title: 'Tacos', desiredPeople: 4 },
          ],
        },
      },
    ])
  })

  it('renders the cached list and recipe selection summary', async () => {
    render(<OfflineSnapshotView />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Family' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('Available lists')).toBeInTheDocument()
    expect(
      screen.getByText('Run revision 4 · 3 grocery items'),
    ).toBeInTheDocument()
    expect(screen.getByText('Tacos · 4 people')).toBeInTheDocument()
  })

  it('explains when this device has no saved run', async () => {
    mocks.getOfflineSnapshots.mockResolvedValue([])

    render(<OfflineSnapshotView />)

    await waitFor(() =>
      expect(
        screen.getByText(/No shopping run has been saved on this device yet/i),
      ).toBeInTheDocument(),
    )
  })
})
