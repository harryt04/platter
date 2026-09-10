import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GroceryCategoryOrderSection } from '@/components/lists/grocery-category-order-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

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
})
