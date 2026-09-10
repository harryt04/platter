import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineMutationSync } from '@/components/states/offline-mutation-sync'

const mocks = vi.hoisted(() => ({
  synchronizeOfflineOperations: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/offline/sync', () => ({
  synchronizeOfflineOperations: mocks.synchronizeOfflineOperations,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

describe('OfflineMutationSync', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  it('refreshes the authoritative page after reconnect synchronization', async () => {
    mocks.synchronizeOfflineOperations.mockResolvedValue({
      attempted: 2,
      synced: 2,
      failed: 0,
    })

    render(<OfflineMutationSync userId="user-1" />)

    await waitFor(() =>
      expect(
        screen.getByText(
          'Offline changes are synced. Showing the latest shared list.',
        ),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Synced')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('does not leave a syncing state when there is no queued work', async () => {
    mocks.synchronizeOfflineOperations.mockResolvedValue({
      attempted: 0,
      synced: 0,
      failed: 0,
    })

    render(<OfflineMutationSync userId="user-1" />)
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
