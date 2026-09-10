import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LeaveListButton } from '@/components/lists/leave-list-button'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('LeaveListButton', () => {
  it('names the shared impact and leaves after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<LeaveListButton listId="list-1" listName="Family" />)

    expect(
      screen.getByText(
        'You will lose access to “Family” and its shared shopping run.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave this list' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(
      screen.getByText(/Your other lists will not be affected/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Leave list' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/lists/list-1/leave', {
      method: 'POST',
    })
    expect(push).toHaveBeenCalledWith('/lists')
  })
})
