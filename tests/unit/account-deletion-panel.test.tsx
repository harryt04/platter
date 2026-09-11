import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountDeletionPanel } from '@/components/settings/account-deletion-panel'

const push = vi.fn()
const { clearOfflineSession } = vi.hoisted(() => ({
  clearOfflineSession: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/offline/database', () => ({
  clearOfflineSession,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccountDeletionPanel', () => {
  it('requires the account email and password before submitting', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    render(<AccountDeletionPanel email="user@example.test" userId="user-1" />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(screen.getByText(/This cannot be undone/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete permanently' }),
    ).toBeDisabled()

    await user.type(
      screen.getByLabelText(/Type user@example.test/i),
      'user@example.test',
    )
    await user.type(screen.getByLabelText('Enter your password'), 'secret')
    expect(
      screen.getByRole('button', { name: 'Delete permanently' }),
    ).toBeEnabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears the exact deleted account’s local state after the server confirms deletion', async () => {
    const user = userEvent.setup()
    clearOfflineSession.mockResolvedValue(undefined)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    render(<AccountDeletionPanel email="user@example.test" userId="user-1" />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.type(
      screen.getByLabelText(/Type user@example.test/i),
      'user@example.test',
    )
    await user.type(screen.getByLabelText('Enter your password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))

    await waitFor(() => {
      expect(clearOfflineSession).toHaveBeenCalledWith('user-1')
      expect(push).toHaveBeenCalledWith('/sign-in?deleted=1')
    })
  })
})
