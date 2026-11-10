import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SplitGroceryContributionButton } from '@/components/lists/split-grocery-contribution-button'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('SplitGroceryContributionButton', () => {
  it('confirms the shared correction and sends the contribution identity', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Split into a separate item.' }), {
        status: 200,
      }),
    )

    render(
      <SplitGroceryContributionButton
        baseRevision={3}
        contributionId="manual-a"
        contributionLabel="2 cups onions"
        ingredientName="onions"
        listId="list-1"
        itemId="grocery:merged:onions:volume:cup"
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Split 2 cups onions into separate grocery item',
      }),
    )
    expect(
      screen.getByText(/will become a separate onions item/),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Split item' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/grocery-items/grocery%3Amerged%3Aonions%3Avolume%3Acup/split',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"contributionId":"manual-a"'),
      }),
    )
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('returns focus to the split trigger when the correction is dismissed', async () => {
    const user = userEvent.setup()

    render(
      <SplitGroceryContributionButton
        baseRevision={3}
        contributionId="manual-a"
        contributionLabel="2 cups onions"
        ingredientName="onions"
        listId="list-1"
        itemId="grocery:merged:onions:volume:cup"
      />,
    )

    const trigger = screen.getByRole('button', {
      name: 'Split 2 cups onions into separate grocery item',
    })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Keep combined' }))

    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
