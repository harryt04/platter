import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineSnapshotView } from '@/components/states/offline-snapshot-view'

const mocks = vi.hoisted(() => ({
  getOfflineSnapshots: vi.fn(),
  getOfflineShellSnapshot: vi.fn(),
  getOfflineOperations: vi.fn(),
  getRememberedOfflineUser: vi.fn(),
}))
vi.mock('@/lib/offline/database', () => ({
  getOfflineSnapshots: mocks.getOfflineSnapshots,
  getOfflineShellSnapshot: mocks.getOfflineShellSnapshot,
  getOfflineOperations: mocks.getOfflineOperations,
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
    mocks.getOfflineOperations.mockResolvedValue([
      {
        operationId: 'operation-pending',
        clientId: 'client-1',
        listId: 'list-1',
        runId: 'run-1',
        kind: 'grocery.purchased.set',
        payload: { itemId: 'grocery:rice', purchased: true },
        baseRevision: 4,
        createdAt: '2026-09-10T12:00:00.000Z',
        attemptCount: 0,
        status: 'pending',
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
    expect(screen.getByText('Offline changes')).toBeInTheDocument()
    expect(screen.getByText('Purchased status')).toBeInTheDocument()
    expect(screen.getByText('Pending sync')).toBeInTheDocument()
  })

  it('explains when this device has no saved run', async () => {
    mocks.getOfflineSnapshots.mockResolvedValue([])
    mocks.getOfflineOperations.mockResolvedValue([])

    render(<OfflineSnapshotView />)

    await waitFor(() =>
      expect(
        screen.getByText(/No shopping run has been saved on this device yet/i),
      ).toBeInTheDocument(),
    )
  })

  it('shows every persisted queue state without exposing operation payloads', async () => {
    mocks.getOfflineSnapshots.mockResolvedValue([])
    mocks.getOfflineOperations.mockResolvedValue([
      ...['syncing', 'failed', 'synced'].map((status, index) => ({
        operationId: `operation-${status}`,
        clientId: 'client-1',
        listId: 'list-1',
        runId: 'run-1',
        kind: 'grocery.already-have.set',
        payload: { itemId: `private-item-${index}` },
        createdAt: '2026-09-10T12:00:00.000Z',
        attemptCount: index + 1,
        status,
      })),
    ])

    render(<OfflineSnapshotView />)

    await waitFor(() =>
      expect(
        screen.getByRole('list', { name: 'Offline operations' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getAllByText('Already have status')).toHaveLength(3)
    expect(screen.getByText('Syncing')).toBeInTheDocument()
    expect(screen.getByText('Sync needs attention')).toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(screen.queryByText(/private-item/)).not.toBeInTheDocument()
  })
})
