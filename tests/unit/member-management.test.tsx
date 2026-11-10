import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemberManagement } from '@/components/lists/member-management'
import type { ListMember } from '@/lib/lists'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const members: ListMember[] = [
  { userId: 'owner-1', role: 'owner', invitationState: 'active' },
  { userId: 'editor-1', role: 'editor', invitationState: 'active' },
]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('MemberManagement', () => {
  it('promotes an editor after an explicit confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          member: { ...members[1], role: 'owner' },
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <MemberManagement
        listId="list-1"
        listName="Family"
        initialMembers={members}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Make owner' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/able to invite/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Make owner' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/members/editor-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'owner' }),
      }),
    )
    expect(
      screen.getByText('editor-1 is now an owner of “Family”.'),
    ).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('removes an editor and keeps pending invitations in a separate section', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ list: { members: [members[0]] } }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <MemberManagement
        listId="list-1"
        listName="Family"
        initialMembers={members}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Active members' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText(/immediately lose access/),
    ).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove member' }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/members/editor-1',
      { method: 'DELETE' },
    )
    expect(screen.queryByText('editor-1')).not.toBeInTheDocument()
    expect(screen.getByText(/no longer has access/)).toBeInTheDocument()
  })
})
