import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountDeletionPanel } from '@/components/settings/account-deletion-panel'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/offline/database', () => ({
  clearOfflineSession: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccountDeletionPanel', () => {
  it('requires the account email and password before submitting', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    render(<AccountDeletionPanel email="user@example.test" />)

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
})
