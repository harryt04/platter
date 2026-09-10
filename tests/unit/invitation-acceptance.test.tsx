import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvitationAcceptance } from '@/components/lists/invitation-acceptance'

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('InvitationAcceptance', () => {
  it('preserves the invitation when an unauthenticated recipient signs in', () => {
    render(
      <InvitationAcceptance
        token="token"
        invitationPath="/invitations/token"
        listName="Family"
        email="guest@example.com"
        isAuthenticated={false}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Sign in to accept' }),
    ).toHaveAttribute('href', '/sign-in?returnTo=%2Finvitations%2Ftoken')
    expect(
      screen.getByRole('link', { name: 'Create an account' }),
    ).toHaveAttribute('href', '/sign-up?returnTo=%2Finvitations%2Ftoken')
  })

  it('accepts a pending invitation and opens the list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ list: { id: 'list-1' } })),
      )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <InvitationAcceptance
        token="token"
        invitationPath="/invitations/token"
        listName="Family"
        email="guest@example.com"
        isAuthenticated
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Join Family' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/invitations/token', {
      method: 'POST',
    })
    expect(push).toHaveBeenCalledWith('/lists/list-1')
    expect(refresh).toHaveBeenCalled()
  })

  it('communicates expired invitations without offering an accept action', () => {
    render(
      <InvitationAcceptance
        token="token"
        invitationPath="/invitations/token"
        listName="Family"
        email="guest@example.com"
        isAuthenticated
        unavailable="expired"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This invitation has expired.',
    )
    expect(
      screen.queryByRole('button', { name: 'Join Family' }),
    ).not.toBeInTheDocument()
  })
})
