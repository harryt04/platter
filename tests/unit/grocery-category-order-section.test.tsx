import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroceryCategoryOrderSection } from '@/components/lists/grocery-category-order-section'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('GroceryCategoryOrderSection', () => {
  it('offers a pointer drag path and equivalent touch-safe move buttons', () => {
    const { container } = render(
      <GroceryCategoryOrderSection
        categories={['produce', 'dairy-eggs']}
        category="produce"
        listId="list-1"
      >
        <p>Apples</p>
      </GroceryCategoryOrderSection>,
    )

    expect(screen.getByRole('heading', { name: 'Produce' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Move Produce category up' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Produce category down' }),
    ).toBeEnabled()
    expect(container.querySelector('[draggable="true"]')).toBeTruthy()
  })

  it('restores focus to the moved category after a successful keyboard move', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Grocery category order changed.' }),
        { status: 200 },
      ),
    )

    const view = render(
      <GroceryCategoryOrderSection
        categories={['produce', 'dairy-eggs']}
        category="produce"
        listId="list-1"
      >
        <p>Milk</p>
      </GroceryCategoryOrderSection>,
    )

    const moveUp = screen.getByRole('button', {
      name: 'Move Produce category up',
    })
    const moveDown = screen.getByRole('button', {
      name: 'Move Produce category down',
    })
    moveDown.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())

    view.rerender(
      <GroceryCategoryOrderSection
        categories={['produce', 'dairy-eggs']}
        category="dairy-eggs"
        listId="list-1"
      >
        <p>Milk</p>
      </GroceryCategoryOrderSection>,
    )

    await waitFor(() => expect(moveUp).toHaveFocus())
    expect(refresh).toHaveBeenCalledOnce()
  })
})
