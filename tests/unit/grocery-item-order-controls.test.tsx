import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GroceryItemOrderControls } from '@/components/lists/grocery-item-order-controls'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

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
})
