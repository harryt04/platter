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
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
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
})
