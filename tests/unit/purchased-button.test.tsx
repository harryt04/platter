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
const offline = vi.hoisted(() => ({
  browserIsOffline: vi.fn(),
  queueBrowserMutation: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/offline/mutations', () => offline)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
  offline.browserIsOffline.mockReset()
  offline.queueBrowserMutation.mockReset()
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

  it('queues an offline change and gives immediate local feedback', async () => {
    offline.browserIsOffline.mockReturnValue(true)
    offline.queueBrowserMutation.mockResolvedValue({ operationId: 'op-1' })

    render(
      <PurchasedButton
        baseRevision={3}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked={false}
        runId="run-1"
        userId="user-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark rice purchased' }))

    await waitFor(() =>
      expect(offline.queueBrowserMutation).toHaveBeenCalledOnce(),
    )
    expect(offline.queueBrowserMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        listId: 'list-1',
        runId: 'run-1',
        baseRevision: 3,
        kind: 'grocery.purchased.set',
        payload: { itemId: 'grocery:rice', purchased: true },
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Undo purchased for rice' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('Pending sync')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('can undo an offline purchase before synchronization', async () => {
    offline.browserIsOffline.mockReturnValue(true)
    offline.queueBrowserMutation.mockResolvedValue({ operationId: 'op-1' })

    render(
      <PurchasedButton
        baseRevision={3}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked={false}
        runId="run-1"
        userId="user-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark rice purchased' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Undo purchased for rice' }),
      ).toBeInTheDocument(),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Undo purchased for rice' }),
    )
    await waitFor(() =>
      expect(offline.queueBrowserMutation).toHaveBeenCalledTimes(2),
    )
    expect(offline.queueBrowserMutation.mock.calls[1]?.[0]).toMatchObject({
      kind: 'grocery.purchased.undo',
      payload: { itemId: 'grocery:rice', purchased: false },
    })
    expect(
      screen.getByRole('button', { name: 'Mark rice purchased' }),
    ).toBeInTheDocument()
  })
})
