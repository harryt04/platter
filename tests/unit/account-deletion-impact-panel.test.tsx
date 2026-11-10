import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountDeletionImpactPanel } from '@/components/settings/account-deletion-impact-panel'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const impact = {
  ownedLists: 2,
  soleOwnerLists: ['Family'],
  soleOwnerListDetails: [
    { listId: 'list-1', listName: 'Family', activeMemberCount: 1 },
  ],
  memberships: 3,
  manuallyAuthoredRecipes: 4,
  publicImportedRecipes: 1,
  completedShoppingRuns: 5,
}

describe('AccountDeletionImpactPanel', () => {
  it('shows the concrete impact and sole-owner warning', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ impact }), { status: 200 }),
    )

    render(<AccountDeletionImpactPanel />)

    expect(
      await screen.findByText('Before you delete your account'),
    ).toBeInTheDocument()
    expect(screen.getByText('Owned lists')).toBeInTheDocument()
    expect(screen.getByText('Manually authored recipes')).toBeInTheDocument()
    expect(screen.getByText('Public imported recipes')).toBeInTheDocument()
    expect(screen.getByText(/only owner of “Family”/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Transfer ownership' }),
    ).toHaveAttribute('href', '/lists/list-1/members')
    expect(screen.getByRole('link', { name: 'Delete list' })).toHaveAttribute(
      'href',
      '/lists/list-1',
    )
    expect(
      screen.getByText(/No deletion starts from this summary/i),
    ).toBeInTheDocument()
  })

  it('offers a retry after loading fails', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'Deletion details are unavailable.' }),
          { status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ impact }), { status: 200 }),
      )

    render(<AccountDeletionImpactPanel />)

    expect(
      await screen.findByText('Deletion details are unavailable.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Owned lists')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
