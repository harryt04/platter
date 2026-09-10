import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PurchasedButton } from '@/components/lists/purchased-button'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('PurchasedButton', () => {
  it('provides a touch-safe pressed control and announces a purchase', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Marked rice purchased.' }), {
        status: 200,
      }),
    )
    render(
      <PurchasedButton
        baseRevision={3}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked={false}
      />,
    )

    const button = screen.getByRole('button', { name: 'Mark rice purchased' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.className).toContain('min-h-11')
    fireEvent.click(button)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH' })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Marked rice purchased.',
    )
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('offers an accessible undo and disables it for archived lists', () => {
    render(
      <PurchasedButton
        baseRevision={3}
        editable={false}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Undo purchased for rice' }),
    ).toBeDisabled()
    expect(
      screen.getByText('This archived list is read-only.'),
    ).toBeInTheDocument()
  })
})
