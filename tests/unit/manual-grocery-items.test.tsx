import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualGroceryItems } from '@/components/lists/manual-grocery-items'
import { isoDateTime } from '@/lib/contracts/ids'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const addition = {
  id: 'manual-1',
  ingredient: {
    originalText: '2 bags spinach',
    quantity: '2',
    unit: 'bag',
    ingredientName: 'spinach',
    parserConfidence: 'high' as const,
    optional: false,
  },
  createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('ManualGroceryItems', () => {
  it('adds and refreshes after a successful manual item mutation', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Manual grocery item added.' }), {
        status: 201,
      }),
    )

    render(
      <ManualGroceryItems
        additions={[]}
        baseRevision={3}
        listId="list-1"
        listName="Family"
      />,
    )
    await user.type(screen.getByLabelText('Add a grocery item'), 'paper towels')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/manual-items',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      line: 'paper towels',
      clientId: expect.any(String),
      operationId: expect.any(String),
      baseRevision: 3,
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('edits and confirms removal without touching recipe data', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Manual grocery item changed.' }), {
        status: 200,
      }),
    )

    render(
      <ManualGroceryItems
        additions={[addition]}
        baseRevision={3}
        listId="list-1"
        listName="Family"
      />,
    )
    const input = screen.getByLabelText('Manual grocery item 1')
    await user.clear(input)
    await user.type(input, '3 bags spinach')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/manual-items/manual-1',
      expect.objectContaining({ method: 'PATCH' }),
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      /recipe ingredients and recipe versions stay unchanged/i,
    )
    await user.click(screen.getByRole('button', { name: 'Remove item' }))
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/manual-items/manual-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('disables editing for archived runs', () => {
    render(
      <ManualGroceryItems
        additions={[addition]}
        editable={false}
        listId="list-1"
        listName="Family"
      />,
    )

    expect(screen.getByText(/archived list is read-only/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Manual grocery item 1')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull()
  })
})
