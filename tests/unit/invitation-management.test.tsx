import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvitationManagement } from '@/components/lists/invitation-management'
import type { EntityId, IsoDateTime } from '@/lib/contracts/ids'
import type { InvitationSummary } from '@/lib/invitations'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const invitation: InvitationSummary = {
  id: '550e8400-e29b-41d4-a716-446655440000' as EntityId,
  listId: 'list-1' as EntityId,
  email: 'guest@example.com',
  status: 'pending' as const,
  expiresAt: '2026-09-17T12:00:00.000Z' as IsoDateTime,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('InvitationManagement', () => {
  it('creates an invitation and shows the returned share link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          invitation: { ...invitation, inviteUrl: 'http://localhost/invite' },
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <InvitationManagement
        listId="list-1"
        listName="Family"
        initialInvitations={[]}
      />,
    )

    await user.type(screen.getByLabelText('Email address'), 'guest@example.com')
    await user.click(screen.getByRole('button', { name: 'Invite to Family' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/invitations',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(
      screen.getByRole('link', { name: 'http://localhost/invite' }),
    ).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('resends and revokes pending invitations with explicit actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            invitation: { ...invitation, inviteUrl: 'http://localhost/new' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ invitation: { ...invitation, status: 'revoked' } }),
          {
            status: 200,
          },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <InvitationManagement
        listId="list-1"
        listName="Family"
        initialInvitations={[invitation]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Resend' }))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/lists/list-1/invitations/${invitation.id}`,
      { method: 'POST' },
    )
    expect(
      screen.getByRole('link', { name: 'http://localhost/new' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText(/link will stop working/),
    ).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Revoke invitation' }),
    )

    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/v1/lists/list-1/invitations/${invitation.id}`,
      { method: 'DELETE' },
    )
    expect(screen.getByText('Invitation revoked')).toBeInTheDocument()
  })
})
