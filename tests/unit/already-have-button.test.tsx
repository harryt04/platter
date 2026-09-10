import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlreadyHaveButton } from '@/components/lists/already-have-button'

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

describe('AlreadyHaveButton', () => {
  it('marks an item with one accessible action and announces the result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'Marked rice already have. It’s hidden from your buy view.',
        }),
        { status: 200 },
      ),
    )
    render(
      <AlreadyHaveButton
        baseRevision={3}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked={false}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Mark rice already have' }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH' })
    expect(screen.getByRole('status')).toHaveTextContent(
      /hidden from your buy view/,
    )
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('undoes an existing state and disables the action for archived lists', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Added rice back to your buy view.' }),
        {
          status: 200,
        },
      ),
    )
    render(
      <AlreadyHaveButton
        baseRevision={3}
        editable={false}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Undo already have for rice' }),
    ).toBeDisabled()
    expect(
      screen.getByText('This archived list is read-only.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('queues an offline change and exposes pending sync state', async () => {
    offline.browserIsOffline.mockReturnValue(true)
    offline.queueBrowserMutation.mockResolvedValue({ operationId: 'op-1' })

    render(
      <AlreadyHaveButton
        baseRevision={3}
        ingredientName="rice"
        itemId="grocery:rice"
        listId="list-1"
        marked={false}
        runId="run-1"
        userId="user-1"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Mark rice already have' }),
    )

    await waitFor(() =>
      expect(offline.queueBrowserMutation).toHaveBeenCalledOnce(),
    )
    expect(offline.queueBrowserMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        listId: 'list-1',
        runId: 'run-1',
        kind: 'grocery.already-have.set',
        payload: { itemId: 'grocery:rice', alreadyHave: true },
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Undo already have for rice' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Pending sync')).toBeInTheDocument()
  })
})
