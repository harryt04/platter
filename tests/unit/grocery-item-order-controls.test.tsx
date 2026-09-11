import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroceryItemOrderControls } from '@/components/lists/grocery-item-order-controls'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('GroceryItemOrderControls', () => {
  it('exposes clear, touch-safe move buttons and disables unavailable moves', () => {
    render(
      <GroceryItemOrderControls
        canMoveDown
        canMoveUp={false}
        ingredientName="Onions"
        itemId="onions"
        listId="list-1"
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Move Onions up' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Onions down' }),
    ).toBeEnabled()
  })

  it('restores focus to the moved item after a successful keyboard move', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Item order changed.' }), {
        status: 200,
      }),
    )

    render(
      <GroceryItemOrderControls
        canMoveDown
        canMoveUp
        ingredientName="Onions"
        itemId="onions"
        listId="list-1"
      />,
    )

    const moveUp = screen.getByRole('button', { name: 'Move Onions up' })
    const moveDown = screen.getByRole('button', { name: 'Move Onions down' })
    moveUp.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(moveDown).toHaveFocus())
    expect(refresh).toHaveBeenCalledOnce()
  })
})
